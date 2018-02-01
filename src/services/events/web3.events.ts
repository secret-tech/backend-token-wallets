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
  }
  return TRANSACTION_STATUS_FAILED;
}

const CONCURRENT_PROCESS_PENDING_COUNT = 6;
const TRANSACTION_CHECKING_INTERVAL_TIME: number = 15000;

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
        this.checkPendingTransactions()
          .then(() => {}, (err) => { this.logger.error('Error was occurred', err); })
          .then(() => { intervalExecuteMethod(); });
      }, TRANSACTION_CHECKING_INTERVAL_TIME);
    };

    intervalExecuteMethod();
  }

  /**
   *
   */
  async checkPendingTransactions(): Promise<boolean> {
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
        (txWithMaxBlockHeight.length && txWithMaxBlockHeight.pop().blockNumber || 0) - 1,
        config.web3.startBlock
      );
    }

    const currentBlock = await this.web3.eth.getBlockNumber();
    if (!this.lastCheckingBlock) {
      this.lastCheckingBlock = currentBlock;
    }

    this.logger.debug('Check blocks from', currentBlock, 'to', this.lastCheckingBlock);
    // @TODO: Also should process blocks in concurrent mode
    for (let i = this.lastCheckingBlock; i < currentBlock; i++) {
      const blockData = await this.web3.eth.getBlock(i, true);

      if (!(i % 10)) {
        this.logger.debug('Blocks processed:', i);
      }

      if (!blockData) {
        continue;
      }

      try {
        await processAsyncItemsByChunks(blockData.transactions || [], CONCURRENT_PROCESS_PENDING_COUNT,
          transaction => this.processPendingTransaction(transaction, blockData));
      } catch (err) {
        this.logger.error(err);
      }
    }

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

    const blockData = await this.web3.eth.getBlock(data.hash, true);
    const transactions = blockData.transactions;
    for (let transaction of transactions) {
      await this.processPendingTransaction(transaction, blockData);
    }
  }

  /**
   *
   * @param data
   */
  async processPendingTransaction(data: any, blockData: any): Promise<void> {
    const txHash = data.transactionHash || data.hash;
    const tx = await this.txRep.getByHash(txHash);
    if (!tx || tx.status !== TRANSACTION_STATUS_PENDING) {
      return;
    }

    this.logger.debug('Check status of pending transaction', txHash);

    // is it need?
    const transactionReceipt = await this.web3.eth.getTransactionReceipt(txHash);
    if (!transactionReceipt) {
      return;
    }

    blockData = blockData || await this.web3.eth.getBlock(data.blockNumber);

    this.logger.info('Process pending transaction', txHash);

    tx.status = getTxStatusByReceipt(transactionReceipt);
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
      .on('data', (txHash) => this.processPendingTransaction(txHash, null));
  }
}

const Web3EventType = Symbol('Web3EventInterface');

export { Web3EventType };
