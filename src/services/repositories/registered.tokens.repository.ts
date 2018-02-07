import { getConnection, getMongoManager } from 'typeorm';
import { injectable } from 'inversify';

import { RegisteredToken } from '../../entities/registered.token';

export enum RegisteredTokenScope {
  Local = '',
  Global = 'global'
}

/**
 *
 */
export interface RegisteredTokenRepositoryInterface {
  save(tx: RegisteredToken): Promise<RegisteredToken>;
  getAllByScope(scope?: string): Promise<RegisteredToken[]>;
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

  getAllByScope(scope?: string): Promise<RegisteredToken[]> {
    return getConnection().getMongoRepository(RegisteredToken).createCursor({
      scope: scope || RegisteredTokenScope.Local
    })
    .sort('symbol', 1)
    .toArray();
  }

  getByContractAddress(contractAddress: string): Promise<RegisteredToken> {
    return getConnection().getMongoRepository(RegisteredToken).findOne({
      contractAddress
    });
  }
}

const RegisteredTokenRepositoryType = Symbol('RegisteredTokenRepositoryInterface');
export { RegisteredTokenRepositoryType };
