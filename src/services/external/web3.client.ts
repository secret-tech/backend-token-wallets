import { injectable } from 'inversify';

const Web3 = require('web3');
const net = require('net');

import config from '../../config';

import { getPrivateKeyByMnemonicAndSalt } from '../crypto';
import Contract from './web3.contract';
import { Logger } from '../../logger';

export interface Web3ClientInterface {
  sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string>;
  getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any;
  getEthBalance(address: string): Promise<string>;
  sufficientBalance(input: TransactionInput): Promise<boolean>;
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
  }

  /**
   *
   * @param input
   * @param mnemonic
   * @param salt
   */
  sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string> {
    this.logger.debug('SendTransactionByMnemonic', input.amount, input.from, input.to, input.gas, input.gasPrice);

    const privateKey = getPrivateKeyByMnemonicAndSalt(mnemonic, salt);

    const params = {
      value: this.web3.utils.toWei(input.amount.toString()),
      from: input.from,
      to: input.to,
      gas: input.gas,
      gasPrice: this.web3.utils.toWei(input.gasPrice, 'gwei'),
      data: input.data
    };

    return new Promise<string>((resolve, reject) => {
      this.sufficientBalance(input).then((sufficient) => {
        if (!sufficient) {
          reject({
            message: 'Insufficient funds to perform this operation and pay tx fee'
          });
        }

        this.web3.eth.accounts.signTransaction(params, privateKey).then(transaction => {
          this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
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
      });
    });
  }

  /**
   *
   * @param mnemonic
   * @param salt
   */
  getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any {
    const privateKey = getPrivateKeyByMnemonicAndSalt(mnemonic, salt);
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
    this.logger.error(new Date().toUTCString() + ': Web3 socket connection closed. Trying to reconnect');
    const webSocketProvider = new Web3.providers.WebsocketProvider(config.rpc.address);
    webSocketProvider.connection.onclose = () => {
      this.logger.info(new Date().toUTCString() + ':Web3 socket connection closed');
      setTimeout(() => {
        this.onWsClose();
      }, config.rpc.reconnectTimeout);
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
