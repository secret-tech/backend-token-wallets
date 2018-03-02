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
import { fromWeiToUnitValue } from '../tokens/helpers';
import { WalletNotFound } from '../../exceptions';

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
  async balancesFor(user: User, walletAddress: string): Promise<any> {
    walletAddress = walletAddress || user.getSingleWalletOrThrowError().address;

    this.logger.debug('[balancesFor]', { meta: { email: user.email, walletAddress } });

    const wallet = user.getWalletByAddress(walletAddress);
    if (!wallet) {
      throw new WalletNotFound('Wallet not found: ' + walletAddress);
    }

    const [ethBalance, erc20TokensBalance] = await dashboardCache.run('ubalances' + user.id.toString() + walletAddress, () => {
      return Promise.all([
        this.web3Client.getEthBalance(wallet.address),

        processAsyncItemsByChunks(wallet.tokens, CONCURRENT_GET_TOKEN_BALANCEOF, (token) => {
          return new Erc20TokenService(this.web3Client, token.contractAddress)
            .getBalanceOf(wallet.address).then(balance => {
              return { ...token, balance: fromWeiToUnitValue(balance, token && token.decimals || 0) };
            });
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
    contractAddress = toEthChecksumAddress(contractAddress);

    this.logger.debug('[getErc20TokenInfo]', { meta: { contractAddress } });

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
