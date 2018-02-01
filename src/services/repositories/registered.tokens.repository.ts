import { getConnection, getMongoManager } from 'typeorm';
import { injectable } from 'inversify';

import { RegisteredToken } from '../../entities/registered.token';

/**
 *
 */
export interface RegisteredTokenRepositoryInterface {
  save(tx: RegisteredToken): Promise<RegisteredToken>;
  getAll(scope?: string): Promise<RegisteredToken[]>;
  getByContractAddress(address: string): Promise<RegisteredToken>;
}

/**
 *
 */
@injectable()
export class RegisteredTokenRepository implements RegisteredTokenRepositoryInterface {
  /**
   *
   * @param tx
   */
  save(tx: RegisteredToken): Promise<RegisteredToken> {
    return getConnection().getMongoRepository(RegisteredToken).save(tx);
  }

  getAll(scope?: string): Promise<RegisteredToken[]> {
    return getConnection().getMongoRepository(RegisteredToken).find({
      scope: scope || '',
      order: {
        symbol: 1
      }
    });
  }

  getByContractAddress(contractAddress: string): Promise<RegisteredToken> {
    return getConnection().getMongoRepository(RegisteredToken).findOne({
      contractAddress
    });
  }
}

const RegisteredTokenRepositoryType = Symbol('RegisteredTokenRepositoryInterface');
export { RegisteredTokenRepositoryType };
