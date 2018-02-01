import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';

import config from '../../../config';

import { User } from '../../../entities/user';
import { Logger } from '../../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../../repositories/user.repository';
import { RegisteredTokenRepository, RegisteredTokenRepositoryType, RegisteredTokenRepositoryInterface } from '../../repositories/registered.tokens.repository';
import { Token } from '../../../entities/token';

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
  async getUserInfo(user: User): Promise<UserInfo> {
    return {
      ethAddress: user.wallets[0].address,
      tokens: user.wallets[0].tokens.map(t => {
        return {
          ...t,
          balance: undefined
        };
      }),
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
