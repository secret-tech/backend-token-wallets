import { injectable } from 'inversify';

const Web3 = require('web3');
const net = require('net');

import config from '../../config';

import { getPrivateKeyByMnemonicAndSalt } from '../crypto';
import Contract from './web3.contract';
import { Logger } from '../../logger';
import { EncodedTransaction, Account } from 'web3/types';

export interface Web3ClientInterface {
  sendTransactionByAccount(input: TransactionInput, account: Account): Promise<string>;
  signTransactionByAccount(input: TransactionInput, account: Account): Promise<EncodedTransaction>;
  sendSignedTransaction(rawTransaction: string): Promise<string>;

  sufficientBalance(input: TransactionInput): Promise<boolean>;
  getAccountByMnemonicAndSalt(mnemonic: string, salt: string, walletIndex: number): any;
  getEthBalance(address: string): Promise<string>;
  getCurrentGasPrice(): Promise<string>;
  getContract(abi: any[], address?: string): Contract;
  getTransactionFee(gas: string): Promise<any>;
}

/* istanbul ignore next */
@injectable()
export class Web3Client implements Web3ClientInterface {
  private logger = Logger.getInstance('WEB3_CLIENT');
  private web3: any;

  /**
   *
   */
  constructor() {
    switch (config.web3.type) {
      case 'ipc':
        this.web3 = new Web3(new Web3.providers.IpcProvider(config.web3.address, net));
        break;
      case 'ws':
        const webSocketProvider = new Web3.providers.WebsocketProvider(config.web3.address);

        webSocketProvider.connection.onclose = () => {
          this.logger.info('Web3 socket connection closed');
          this.onWsClose();
        };

        this.web3 = new Web3(webSocketProvider);
        break;
      case 'http':
        this.web3 = new Web3(config.web3.address);
        break;
      default:
        throw Error('Unknown Web3 RPC type!');
    }
  }

  /**
   *
   * @param input
   * @param mnemonic
   * @param salt
   */
  sendTransactionByAccount(input: TransactionInput, account: Account): Promise<string> {
    this.logger.debug('[sendTransactionByAccount]', {
      meta: { amount: input.amount, from: input.from, to: input.to, gas: input.gas, gasPrice: input.gasPrice }
    });

    return this.signTransactionByAccount(input, account).then(tx => {
      return this.sendSignedTransaction(tx.raw);
    });
  }

  /**
   *
   * @param input
   * @param mnemonic
   * @param salt
   */
  async signTransactionByAccount(input: TransactionInput, account: Account): Promise<EncodedTransaction> {
    this.logger.debug('[signTransactionByAccount]', {
      meta: { amount: input.amount, from: input.from, to: input.to, gas: input.gas, gasPrice: input.gasPrice }
    });

    const params = {
      value: this.web3.utils.toWei(input.amount.toString()),
      from: input.from,
      to: input.to,
      gas: input.gas,
      gasPrice: this.web3.utils.toWei(input.gasPrice, 'gwei'),
      data: input.data
    };

    if (!await this.sufficientBalance(input)) {
      throw new Error('Insufficient funds to perform this operation and pay tx fee');
    }

    return this.web3.eth.accounts.signTransaction(params, account.privateKey);
  }

  /**
   *
   * @param input
   * @param mnemonic
   * @param salt
   */
  sendSignedTransaction(rawTransaction: string): Promise<string> {
    this.logger.debug('[sendSignedTransaction]');

    return new Promise<string>((resolve, reject) => {
      this.web3.eth.sendSignedTransaction(rawTransaction)
        .on('transactionHash', transactionHash => {
          resolve(transactionHash);
        })
        .on('error', (error) => {
          reject(error);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   *
   * @param mnemonic
   * @param salt
   */
  getAccountByMnemonicAndSalt(mnemonic: string, salt: string, walletIndex: number): any {
    const privateKey = getPrivateKeyByMnemonicAndSalt(mnemonic, salt, walletIndex);
    return this.web3.eth.accounts.privateKeyToAccount(privateKey);
  }

  /**
   *
   * @param address
   */
  async getEthBalance(address: string): Promise<string> {
    return this.web3.utils.fromWei(
      await this.web3.eth.getBalance(address)
    );
  }

  /**
   *
   * @param input
   */
  sufficientBalance(input: TransactionInput): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBalance(input.from)
        .then((balance) => {
          const BN = this.web3.utils.BN;
          const txFee = new BN(input.gas).mul(new BN(this.web3.utils.toWei(input.gasPrice, 'gwei')));
          const total = new BN(this.web3.utils.toWei(input.amount)).add(txFee);
          resolve(total.lte(new BN(balance)));
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   *
   */
  onWsClose() {
    this.logger.error('Web3 socket connection closed. Trying to reconnect');
    const webSocketProvider = new Web3.providers.WebsocketProvider(config.web3.address);
    webSocketProvider.connection.onclose = () => {
      this.logger.info('Web3 socket connection closed');
      setTimeout(() => {
        this.onWsClose();
      }, config.web3.reconnectTimeout);
    };

    this.web3.setProvider(webSocketProvider);
  }

  /**
   *
   */
  async getCurrentGasPrice(): Promise<string> {
    return this.web3.utils.fromWei(await this.web3.eth.getGasPrice(), 'gwei');
  }

  /**
   *
   * @param gas
   */
  async getTransactionFee(gas: string): Promise<any> {
    const gasPrice = await this.getCurrentGasPrice();
    const BN = this.web3.utils.BN;

    return {
      gasPrice,
      gas,
      expectedTxFee: this.web3.utils.fromWei(
        new BN(gas).mul(new BN(this.web3.utils.toWei(gasPrice, 'gwei'))).toString()
      )
    };
  }

  /**
   *
   * @param address
   */
  getChecksumAddress(address: string): string {
    return this.web3.utils.toChecksumAddress(address);
  }

  /**
   *
   * @param txHash
   */
  getTxReceipt(txHash: string): Promise<any> {
    return this.web3.eth.getTransactionReceipt(txHash);
  }

  /**
   *
   * @param abi
   * @param address
   */
  getContract(abi: any[], address?: string): Contract {
    return new Contract(this, this.web3, abi, address);
  }
}

const Web3ClientType = Symbol('Web3ClientInterface');
export { Web3ClientType };
