import config from '../../config';
import { injectable, inject } from 'inversify';
const Web3 = require('web3');
const Web3Utils = require('web3-utils');
const Web3Abi = require('web3-eth-abi');
const net = require('net');
import { getMongoRepository } from 'typeorm';

import {
  Transaction,
  ERC20_TRANSFER,
  TRANSACTION_STATUS_PENDING,
  TRANSACTION_STATUS_CONFIRMED,
  TRANSACTION_STATUS_FAILED,
  ETHEREUM_TRANSFER
} from '../../entities/transaction';
import { TransactionRepositoryInterface, TransactionRepositoryType } from '../repositories/transaction.repository';
import { chunkArray, processAsyncItemsByChunks, processAsyncIntRangeByChunks } from '../../helpers/helpers';
import { Logger } from '../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../repositories/user.repository';
import { Wallet } from '../../entities/wallet';
import { Transaction as EthTransaction, Block } from 'web3/types';
import { toEthChecksumAddress } from '../crypto';

type WalletsMap = { [k: string]: Wallet[] };
type ExtEthTransaction = EthTransaction & {
  contractAddress: string;
};

export interface Web3EventInterface {
}

function getTxStatusByReceipt(receipt: any): string {
  if (!receipt) {
    return TRANSACTION_STATUS_PENDING;
  }
  if (receipt.status === '0x1') {
    return TRANSACTION_STATUS_CONFIRMED;
  }
  return TRANSACTION_STATUS_FAILED;
}

const CONCURRENT_BLOCK_PROCESS_COUNT = 2;
const CONCURRENT_TRANSACTIONS_PROCESS_COUNT = 4;
const TRANSACTION_CHECKING_INTERVAL_TIME: number = 15000;

// @TODO: Need to refacting
/* istanbul ignore next */
@injectable()
export class Web3Event implements Web3EventInterface {
  private logger = Logger.getInstance('WEB3_EVENT');
  private web3: any;
  // @todo: remove or replace this solution by outside service or simple setTimeout/setInterval
  private lastCheckingBlock: number = 0;

  private erc20Abi: {
    transfer: {
      methodSignature: string;
      abi: any;
    },
    transferFrom: {
      methodSignature: string;
      abi: any;
    }
  };

  /**
   *
   * @param txRep
   */
  constructor(
    @inject(TransactionRepositoryType) private txRep: TransactionRepositoryInterface,
    @inject(UserRepositoryType) private userRep: UserRepositoryInterface
  ) {
    this.erc20Abi = {
      transfer: {
        methodSignature: Web3Abi.encodeFunctionSignature('transfer(address,uint256)').slice(2),
        abi: config.contracts.erc20Token.abi.filter(i => i.type === 'function' && i.name === 'transfer').pop()
      },
      transferFrom: {
        methodSignature: Web3Abi.encodeFunctionSignature('transferFrom(address,uint256,uint256)').slice(2),
        abi: config.contracts.erc20Token.abi.filter(i => i.type === 'function' && i.name === 'transferFrom').pop()
      }
    };

    switch (config.rpc.type) {
      case 'ipc':
        this.web3 = new Web3(new Web3.providers.IpcProvider(config.rpc.address, net));
        break;

      case 'ws':
        const webSocketProvider = new Web3.providers.WebsocketProvider(config.rpc.address);

        webSocketProvider.connection.onclose = () => {
          this.logger.info(new Date().toUTCString() + ':Web3 socket connection closed');
          this.onWsClose();
        };

        this.web3 = new Web3(webSocketProvider);
        break;

      case 'http':
        this.web3 = new Web3(config.rpc.address);
        break;

      default:
        throw Error('Unknown Web3 RPC type!');
    }

    if (config.rpc.type !== 'http') {
      this.attachEvents();
    }

    this.initDeferredTransactionsChecking();
  }

  /**
   *
   */
  private initDeferredTransactionsChecking() {
    this.logger.debug('Start deferrable transaction checking');

    const intervalExecuteMethod = () => {
      setTimeout(() => {
        this.checkTransactions()
          .then(() => { }, (err) => { this.logger.error('Error was occurred', err); })
          .then(() => { intervalExecuteMethod(); });
      }, TRANSACTION_CHECKING_INTERVAL_TIME);
    };

    intervalExecuteMethod();
  }

  /**
   *
   * @param blockData
   */
  private async getWalletMapInTransactions(transactions: ExtEthTransaction[]): Promise<WalletsMap> {
    const txMaps = {};
    transactions.map(t => t.from).concat(transactions.map(t => t.to)).filter(t => t)
      .forEach(t => {
        txMaps[t] = 1;
      })

    const walletIds = {};
    (await this.userRep.getAllByWalletAddresses(
      Object.keys(txMaps)
    )).map(u => u.wallets)
      .reduce((allWallets, wallets) => allWallets.concat(wallets), [])
      .filter(w => txMaps[w.address])
      .forEach(w => {
        walletIds[w.address] = (walletIds[w.address] || [])
        walletIds[w.address].push(w);
      });

    return walletIds;
  }

  private filterTransactionByWalletAddresses(walletsMap: WalletsMap, transactions: ExtEthTransaction[]): ExtEthTransaction[] {
    return transactions
      .filter(t => walletsMap[t.from] || walletsMap[t.to]);
  }

  /**
   *
   */
  async checkTransactions(): Promise<boolean> {
    this.logger.debug('Check transactions in blocks');

    if (!this.lastCheckingBlock) {
      this.logger.debug('Get the biggest block height value from local transactions');

      const txWithMaxBlockHeight = await getMongoRepository(Transaction).find({
        order: {
          blockNumber: -1
        },
        take: 1
      });

      this.lastCheckingBlock = Math.max(
        (txWithMaxBlockHeight.length && txWithMaxBlockHeight.pop().blockNumber || 0) - 1,
        config.web3.startBlock
      );
    }

    const currentBlock = await this.web3.eth.getBlockNumber();
    if (!this.lastCheckingBlock) {
      this.lastCheckingBlock = currentBlock;
    }

    this.logger.debug('Check blocks from', this.lastCheckingBlock, 'to', currentBlock);

    await processAsyncIntRangeByChunks(this.lastCheckingBlock, currentBlock, 1, CONCURRENT_BLOCK_PROCESS_COUNT, async (i) => {
      const blockData: Block = await this.web3.eth.getBlock(i, true);

      if (!(i % 10)) {
        this.logger.debug('Blocks processed:', i);
      }

      if (!blockData) {
        return;
      }

      try {
        await this.processTransactionsInBlock(blockData);
      } catch (err) {
        this.logger.error(err);
      }
    });

    this.lastCheckingBlock = currentBlock - 1;
    this.logger.debug('Change lastCheckingBlock to', this.lastCheckingBlock);

    return true;
  }

  /**
   *
   * @param data
   */
  async processNewBlockHeaders(data: any): Promise<void> {
    if (!data.number) {
      // skip pending blocks
      return;
    }

    this.logger.debug('Process new block headers');

    this.processTransactionsInBlock(await this.web3.eth.getBlock(data.hash, true));
  }

  /**
   *
   * @param blockData
   */
  private async processTransactionsInBlock(blockData: Block) {
    if (!blockData || !blockData.transactions || !blockData.transactions.length) {
      return {};
    }

    // extend transactions in block by parsing erc20 methods
    const sourceTransactions: ExtEthTransaction[] = blockData.transactions.map(t => {
      let contractAddress = undefined;
      if (t.input.length === 2 + 8 + 64 + 64 && t.input.slice(2, 10) === this.erc20Abi.transfer.methodSignature) {
        contractAddress = t.to;
        const methodArgs = Web3Abi.decodeParameters(this.erc20Abi.transfer.abi.inputs, t.input.slice(10));
        t.from = t.from;
        t.to = methodArgs[0];
        t.value = methodArgs[1];
      } else if (t.input.length === 2 + 8 + 64 + 64 + 64 && t.input.slice(2, 10) === this.erc20Abi.transfer.methodSignature) {
        contractAddress = t.to;
        const methodArgs = Web3Abi.decodeParameters(this.erc20Abi.transferFrom.abi.inputs, t.input.slice(10));
        t.from = methodArgs[0];
        t.to = methodArgs[1];
        t.value = methodArgs[2];
      }
      return {
        ...t,
        contractAddress
      }
    });

    const wallets = await this.getWalletMapInTransactions(sourceTransactions);
    if (!Object.keys(wallets).length) {
      return;
    }

    const transactions = this.filterTransactionByWalletAddresses(wallets, sourceTransactions);

    this.logger.debug('Process transactions in block', transactions.length, 'wallets count', Object.keys(wallets).length);

    await processAsyncItemsByChunks(transactions || [], CONCURRENT_TRANSACTIONS_PROCESS_COUNT,
      transaction => this.processTransaction(transaction, blockData, wallets));
  }

  private processNotRegisteredEthereumTransaction(tx: Transaction, ethTx: ExtEthTransaction) {
    tx.type = ETHEREUM_TRANSFER;
    delete tx.contractAddress;
    tx.from = ethTx.from;
    tx.to = ethTx.to;
    tx.amount = Web3Utils.fromWei(ethTx.value);
  }

  private processNotRegisteredContractTransaction(tx: Transaction, ethTx: ExtEthTransaction): boolean {
    const methodSignature = ethTx.input.slice(2, 10);

    if (methodSignature === this.erc20Abi.transfer.methodSignature) {
      tx.from = ethTx.from;
      tx.to = ethTx.to;
      tx.amount = ethTx.value;
    } else if (methodSignature === this.erc20Abi.transfer.methodSignature) {
      tx.from = ethTx.from;
      tx.to = ethTx.to;
      tx.amount = ethTx.value;
    } else {
      return false;
    }

    tx.type = ERC20_TRANSFER;
    tx.contractAddress = ethTx.contractAddress;

    return true;
  }

  /**
   *
   * @param data
   */
  async processTransaction(ethTx: ExtEthTransaction, blockData: Block, walletsMap: WalletsMap): Promise<void> {
    let tx = await this.txRep.getByHash(ethTx.hash);
    // process for not registered tx-s
    if (!tx) {
      tx = Transaction.createTransaction({
        transactionHash: ethTx.hash,
        details: JSON.stringify({
          gas: ethTx.gas,
          gasPrice: Web3Utils.fromWei(ethTx.gasPrice, 'gwei')
        })
      });
      if (ethTx.value && ethTx.input === '0x') {
        this.logger.debug('Process a new ethereum transfer transaction', ethTx.hash);
        this.processNotRegisteredEthereumTransaction(tx, ethTx);
      } else {
        this.logger.debug('Process a new contract transaction', ethTx.hash);
        if (!this.processNotRegisteredContractTransaction(tx, ethTx)) {
          this.logger.debug('Unknown contract action in transaction, skip this', ethTx.hash);
          return;
        }
      }
    } else if (tx.status !== TRANSACTION_STATUS_PENDING) {
      return;
    }

    this.logger.debug('Check status of transaction', ethTx.hash);

    const transactionReceipt = await this.web3.eth.getTransactionReceipt(ethTx.hash);
    if (!transactionReceipt) {
      return;
    }

    blockData = blockData || await this.web3.eth.getBlock(ethTx.blockNumber);

    tx.status = getTxStatusByReceipt(transactionReceipt);

    tx.timestamp = blockData.timestamp;
    tx.blockNumber = blockData.number;

    this.logger.debug('Save processed transaction', tx);

    await this.txRep.save(tx);
  }

  /**
   *
   */
  onWsClose() {
    this.logger.error(new Date().toUTCString() + ': Web3 socket connection closed. Trying to reconnect');
    const webSocketProvider = new Web3.providers.WebsocketProvider(config.rpc.address);
    webSocketProvider.connection.onclose = () => {
      this.logger.info(new Date().toUTCString() + ':Web3 socket connection closed');
      setTimeout(() => {
        this.onWsClose();
      }, config.rpc.reconnectTimeout);
    };

    this.web3.setProvider(webSocketProvider);
    this.attachEvents();
  }

  /**
   *
   */
  attachEvents() {
    this.logger.debug('Attach to eth / contracts events');

    // process new blocks
    this.web3.eth.subscribe('newBlockHeaders')
      .on('data', (data) => this.processNewBlockHeaders(data));

    // process pending transactions
    // this.web3.eth.subscribe('pendingTransactions')
    //   .on('data', (txHash) => this.processTransaction(txHash, null, {}));
  }
}

const Web3EventType = Symbol('Web3EventInterface');

export { Web3EventType };
