import { inject, injectable } from 'inversify';

import config from '../../config';

import { User } from '../../entities/user';
import { Web3ClientInterface, Web3ClientType } from '../external/web3.client';
import { Erc20TokenService } from '../tokens/erc20token.service';
import { Logger } from '../../logger';
import { processAsyncItemsByChunks, CacheMethodResult } from '../../helpers/helpers';
import { RegisteredTokenRepositoryType, RegisteredTokenRepositoryInterface } from '../repositories/registered.tokens.repository';
import { RegisteredToken } from '../../entities/registered.token';
import { toEthChecksumAddress } from '../crypto';

const CONCURRENT_GET_TOKEN_BALANCEOF: number = 2;

const dashboardCache = new CacheMethodResult(4096, 8000);

/**
 * Dashboard Service
 */
@injectable()
export class DashboardApplication {
  private logger = Logger.getInstance('DASHBOARD_APP');

  constructor(
    @inject(Web3ClientType) private web3Client: Web3ClientInterface,
    @inject(RegisteredTokenRepositoryType) private tokensRepository: RegisteredTokenRepositoryInterface
  ) {
  }

  /**
   * Get balances for addr
   * @param user
   */
  async balancesFor(user: User): Promise<any> {
    this.logger.debug('Get balances for', user.email);

    const wallet = user.wallets[0];

    const [ethBalance, erc20TokensBalance] = await dashboardCache.run('ubalances' + user.email, () => {
      return Promise.all([
        this.web3Client.getEthBalance(wallet.address),

        processAsyncItemsByChunks(wallet.tokens, CONCURRENT_GET_TOKEN_BALANCEOF, (token) => {
          return new Erc20TokenService(this.web3Client, token.contractAddress)
            .getBalanceOf(wallet.address).then(balance => { return { ...token, balance }; });
        })
      ]);
    });

    return {
      ethBalance,
      erc20TokensBalance
    };
  }

  /**
   *
   * @param contractAddress
   */
  getErc20TokenInfo(contractAddress: string): Promise<any> {
    this.logger.debug('Request token info for', contractAddress);

    return dashboardCache.run('erc20info' + contractAddress, async () => {
      const regToken = await this.tokensRepository.getByContractAddress(contractAddress);
      if (regToken) {
        return regToken;
      }

      const contractInfo = await (new Erc20TokenService(this.web3Client, contractAddress)).getInfo();
      const token = RegisteredToken.createRegisteredToken(contractInfo);
      token.contractAddress = toEthChecksumAddress(contractAddress);

      if (token.symbol || token.name) {
        await this.tokensRepository.save(token);
      } else {
        return null;
      }

      return token;
    });
  }
}

const DashboardApplicationType = Symbol('DashboardApplicationService');
export { DashboardApplicationType };
