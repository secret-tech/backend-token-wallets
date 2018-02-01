import { injectable } from 'inversify';
import { getMongoManager } from 'typeorm';

import { User } from '../../entities/user';

export interface UserRepositoryInterface {
  save(u: User): Promise<User>;
}

/**
 *
 */
@injectable()
export class UserRepository {
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
