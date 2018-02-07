import { injectable } from 'inversify';
import { getMongoManager } from 'typeorm';

import { User } from '../../entities/user';

export interface UserRepositoryInterface {
  getAllByWalletAddresses(walletAddresses: string[]): Promise<User[]>;
  save(u: User): Promise<User>;
}

/**
 *
 */
@injectable()
export class UserRepository {
  getAllByWalletAddresses(walletAddresses: string[]): Promise<User[]> {
    return getMongoManager().createEntityCursor(User, {
      'wallets.address': {
        $in: walletAddresses
      }
    }).project({
      'wallets.address': 1,
      'wallets.ticker': 1
    })
    .toArray();
  }

  /**
   *
   * @param u
   */
  save(u: User): Promise<User> {
    return getMongoManager().getMongoRepository(User).save(u);
  }
}

const UserRepositoryType = Symbol('UserRepositoryInterface');
export { UserRepositoryType };
