import * as web3utils from 'web3-utils';
import { EncodedTransaction, Account } from 'web3/types';

import config from '../../config';
import Contract from '../external/web3.contract';
import { Web3ClientInterface } from '../external/web3.client';
import { Logger } from '../../logger';
import { decimalsToUnitMap } from './helpers';

const DEFAULT_DECIMALS = 18;

/**
 *
 */
export class Erc20TokenService {
  protected erc20Token: Contract;
  protected logger = Logger.getInstance('ERC20_TOKEN_SERVICE');

  /**
   *
   * @param web3
   */
  constructor(web3: Web3ClientInterface, private contractAddress: string) {
    this.erc20Token = web3.getContract(config.contracts.erc20Token.abi, contractAddress);
  }

  /**
   *
   */
  async getBalanceOf(address: string, decimals: number = 18): Promise<string> {
    return web3utils.fromWei(
      await this.erc20Token.queryMethod({
        methodName: 'balanceOf',
        gasPrice: '0',
        arguments: [address]
      }),
      decimalsToUnitMap(decimals)
    ).toString();
  }

  private catchInfoError(name: string, err: any) {
    this.logger.warn('Cannot get info for', name, this.contractAddress, err);
    return '';
  }

  /**
   *
   */
  getInfo(): Promise<Erc20TokenInfo> {
    return Promise.all([
      this.erc20Token.queryMethod({
        methodName: 'name',
        gasPrice: '0',
        arguments: []
      }).catch(e => this.catchInfoError('name', e)),
      this.erc20Token.queryMethod({
        methodName: 'symbol',
        gasPrice: '0',
        arguments: []
      }).catch(e => this.catchInfoError('symbol', e)),
      this.erc20Token.queryMethod({
        methodName: 'decimals',
        gasPrice: '0',
        arguments: []
      }).catch(e => this.catchInfoError('decimals', e)),
    ]).then(([name, symbol, decimals]) => {
      return {
        name,
        symbol,
        decimals
      };
    });
  }

  /**
   *
   * @param fromAddress
   * @param toAddress
   * @param amount
   */
  async transfer(account: Account, params: { gas: string; gasPrice: string },
    toAddress: string, amount: string): Promise<EncodedTransaction> {
    return this.erc20Token.executeMethod({
      amount: '0',
      methodName: 'transfer',
      arguments: [toAddress, amount],
      gas: params.gas,
      gasPrice: params.gasPrice
    }, account);
  }
}
