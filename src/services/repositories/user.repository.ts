import { injectable } from 'inversify';
import { getMongoManager } from 'typeorm';

import { User } from '../../entities/user';

export interface UserRepositoryInterface {
  newUser(): User;
  save(u: User): Promise<User>;
  getCountByFromOrTo(from: string, to?: string): Promise<number>;
}

/**
 *
 */
@injectable()
export class UserRepository {
  /**
   *
   */
  newUser(): User {
    return getMongoManager().getMongoRepository(User).create();
  }

  /**
   *
   * @param u
   */
  save(u: User): Promise<User> {
    return getMongoManager().getMongoRepository(User).save(u);
  }

  /**
   *
   * @param from
   * @param to
   */
  getCountByFromOrTo(from: string, to?: string): Promise<number> {
    let query;

    if (to) {
      query = {
        '$or': [
          {
            'wallet.address': from
          },
          {
            'wallet.address': to
          }
        ]
      };
    } else {
      query = {
        'wallet.address': from
      };
    }

    return getMongoManager().createEntityCursor(User, query).count(false);
  }
}

const UserRepositoryType = Symbol('UserRepositoryInterface');
export { UserRepositoryType };
