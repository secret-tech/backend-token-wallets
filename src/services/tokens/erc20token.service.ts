import * as web3utils from 'web3-utils';

import config from '../../config';
import Contract from '../external/web3.contract';
import { Web3ClientInterface } from '../external/web3.client';

/**
 *
 */
export class Erc20TokenService {
  protected erc20Token: Contract;

  /**
   *
   * @param web3
   */
  constructor(web3: Web3ClientInterface) {
    this.erc20Token = web3.getContract(config.contracts.erc20Token.abi, config.contracts.erc20Token.address);
  }

  /**
   *
   * @param address
   */
  async getBalanceOf(address: string): Promise<string> {
    return web3utils.fromWei(
      await this.erc20Token.queryMethod({
        methodName: 'balanceOf',
        gasPrice: '0',
        arguments: [address]
      })
    ).toString();
  }

  /**
   *
   * @param fromAddress
   * @param toAddress
   * @param amount
   */
  async transfer(gasPrice: string, fromAddress: string, toAddress: string, amount: string, mnemonic: string, salt: string): Promise<any> {
    return this.erc20Token.executeMethod({
      from: fromAddress,
      amount: '0',
      mnemonic,
      salt,
      methodName: 'transfer',
      arguments: [toAddress, amount],
      gasPrice: '25'
    });
  }
}
