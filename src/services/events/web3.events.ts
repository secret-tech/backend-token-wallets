import config from '../../config';
import { injectable, inject } from 'inversify';
const Web3 = require('web3');
const net = require('net');

import {
  Transaction,
  ERC20_TRANSFER,
  TRANSACTION_STATUS_PENDING,
  TRANSACTION_STATUS_CONFIRMED,
  TRANSACTION_STATUS_FAILED
} from '../../entities/transaction';
import { getMongoRepository } from 'typeorm';
import { TransactionRepositoryInterface, TransactionRepositoryType } from '../repositories/transaction.repository';
import * as Bull from 'bull';
import { chunkArray, processAsyncItemsByChunks } from '../../helpers/helpers';
import { Logger } from '../../logger';

export interface Web3EventInterface {
}

function getTxStatusByReceipt(receipt: any): string {
  if (!receipt) {
    return TRANSACTION_STATUS_PENDING;
  }
  if (receipt.status === '0x1') {
    return TRANSACTION_STATUS_CONFIRMED;
  } else {
    return TRANSACTION_STATUS_FAILED;
  }
}

const CONCURRENT_PROCESS_PENDING_COUNT = 6;

/* istanbul ignore next */
@injectable()
export class Web3Event implements Web3EventInterface {
  private logger = Logger.getInstance('WEB3_EVENT');
  private web3: any;
  private erc20Token: any;
  // @todo: remove or replace this solution by outside service or simple setTimeout/setInterval
  private queueWrapper: any;
  private lastCheckingBlock: number = 0;

  /**
   *
   * @param txRep
   */
  constructor(
    @inject(TransactionRepositoryType) private txRep: TransactionRepositoryInterface
  ) {
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

    this.createContracts();

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

    this.queueWrapper = new Bull('check_transaction', config.redis.url);

    this.queueWrapper.empty().then(() => {
      this.queueWrapper.process((job) => {
        return this.checkPendingTransactions(job);
      });
      this.queueWrapper.add({}, { repeat: { cron: '*/15 * * * *' } });
      this.queueWrapper.on('error', (error) => {
        this.logger.error(error);
      });
      this.queueWrapper.add({});
    }, (err) => {
      this.logger.error(err);
    });
  }

  /**
   *
   */
  createContracts() {
    this.logger.debug('Create contracts');

    this.erc20Token = new this.web3.eth.Contract(config.contracts.erc20Token.abi, config.contracts.erc20Token.address);
  }

  /**
   *
   * @param job
   */
  async checkPendingTransactions(job: any): Promise<boolean> {
    this.logger.debug('Check pending transactions in blocks');

    if (!this.lastCheckingBlock) {
      this.logger.debug('Get the biggest block height value from local transactions');

      const txWithMaxBlockHeight = await getMongoRepository(Transaction).find({
        order: {
          blockNumber: -1
        },
        take: 1
      });

      this.lastCheckingBlock = Math.max(
        txWithMaxBlockHeight.length && txWithMaxBlockHeight.pop().blockNumber,
        config.web3.startBlock
      );
      this.lastCheckingBlock--;
    }

    const currentBlock = await this.web3.eth.getBlockNumber();

    this.logger.debug('Check blocks from', currentBlock, this.lastCheckingBlock);
    // @TODO: Also should process blocks in concurrent mode
    for (let i = this.lastCheckingBlock; i < currentBlock; i++) {
      const blockData = await this.web3.eth.getBlock(i, true);

      if (!(i % 10)) {
        this.logger.debug('Blocks processed', i);
      }

      try {
        await processAsyncItemsByChunks(blockData.transactions || [], CONCURRENT_PROCESS_PENDING_COUNT,
          transaction => this.processPendingTransaction(transaction));
      } catch (err) {
        this.logger.error(err);
      }
    }

    this.logger.debug('Change lastCheckingBlock to', currentBlock);
    this.lastCheckingBlock = currentBlock;

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

    const blockData = await this.web3.eth.getBlock(data.hash, true);
    const transactions = blockData.transactions;
    for (let transaction of transactions) {
      await this.processPendingTransaction(transaction);
    }
  }

  /**
   *
   * @param data
   */
  async processPendingTransaction(data: any): Promise<void> {
    const txHash = data.transactionHash || data.hash;
    const tx = await this.txRep.getByHash(txHash);
    if (!tx || tx.status !== TRANSACTION_STATUS_PENDING) {
      return;
    }

    this.logger.debug('Check status of pending transaction', txHash);

    const transactionReceipt = await this.web3.eth.getTransactionReceipt(txHash);
    if (!transactionReceipt) {
      return;
    }

    this.logger.debug('Process pending transaction', txHash);

    const blockData = await this.web3.eth.getBlock(data.blockNumber);
    const status = getTxStatusByReceipt(transactionReceipt);

    tx.status = status;
    tx.timestamp = blockData.timestamp;
    tx.blockNumber = blockData.number;

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
    this.createContracts();
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
    this.web3.eth.subscribe('pendingTransactions')
      .on('data', (txHash) => this.processPendingTransaction(txHash));

    // process ERC20 transfers
    this.erc20Token.events.Transfer()
      .on('data', (data) => this.processPendingTransaction(data));
  }
}

const Web3EventType = Symbol('Web3EventInterface');

export { Web3EventType };
