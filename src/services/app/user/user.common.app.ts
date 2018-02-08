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
      ethAddress: user.wallets[0].address,
      tokens: user.wallets[0].tokens.map(t => {
        return {
          ...t,
          balance: undefined
        };
      }),
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
  async registerToken(user: User, token: {
    contractAddress: string;
    decimals: number;
    symbol: string;
    name: string;
  }): Promise<any> {
    const userToken = Token.createToken(token);

    // replace
    user.wallets[0].removeToken(userToken);
    user.wallets[0].addToken(userToken);

    await this.userRepository.save(user);

    delete userToken.balance;

    return userToken;
  }
}

const UserCommonApplicationType = Symbol('UserCommonApplicationInterface');
export { UserCommonApplicationType };
