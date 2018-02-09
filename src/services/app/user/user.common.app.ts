import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';

import config from '../../../config';

import { User } from '../../../entities/user';
import { Logger } from '../../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../../repositories/user.repository';
import { RegisteredTokenRepository, RegisteredTokenRepositoryType, RegisteredTokenRepositoryInterface } from '../../repositories/registered.tokens.repository';
import { Token } from '../../../entities/token';
import { getAllNotifications, Preferences } from '../../../entities/preferences';
import { getAllAllowedVerifications } from '../../external/verify.action.service';
import { WalletNotFound } from '../../../exceptions';

/**
 * UserCommonApplication
 */
@injectable()
export class UserCommonApplication {
  private logger = Logger.getInstance('USER_COMMON_APP');

  /**
   * constructor
   */
  constructor(
    @inject(UserRepositoryType) private userRepository: UserRepositoryInterface,
    @inject(RegisteredTokenRepositoryType) private tokensRepository: RegisteredTokenRepositoryInterface
  ) { }

  /**
   *
   * @param user
   */
  async getUserInfo(user: User): Promise<any> {
    // @TODO: Refactor
    const preferences = user.preferences || {};
    if (!Object.keys(preferences['notifications'] || {}).length) {
      preferences['notifications'] = getAllNotifications().reduce((p, c) => (p[c] = true, p), {});
    }
    if (!Object.keys(preferences['verifications'] || {}).length) {
      preferences['verifications'] = getAllAllowedVerifications().reduce((p, c) => (p[c] = true, p), {});
    }

    return {
      wallets: user.wallets.map(w => ({
        ticker: w.ticker,
        address: w.address,
        tokens: w.tokens.map(t => ({ ...t, balance: undefined }))
      })),
      preferences,
      email: user.email,
      name: user.name,
      defaultVerificationMethod: user.defaultVerificationMethod
    };
  }

  /**
   *
   * @param user
   * @param token
   */
  async registerToken(user: User, walletAddress: string, token: {
    contractAddress: string;
    decimals: number;
    symbol: string;
    name: string;
  }): Promise<any> {
    this.logger.debug('Register token for user', user.email, walletAddress, token.contractAddress);

    const wallet = user.getWalletByAddress(walletAddress);
    if (!wallet) {
      throw new WalletNotFound('Wallet not found: ' + walletAddress);
    }

    const userToken = Token.createToken(token);

    // replace
    wallet.removeToken(userToken);
    wallet.addToken(userToken);

    await this.userRepository.save(user);

    delete userToken.balance;

    return userToken;
  }
}

const UserCommonApplicationType = Symbol('UserCommonApplicationInterface');
export { UserCommonApplicationType };
