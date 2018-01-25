import { getConnection, getMongoManager } from 'typeorm';
import { injectable } from 'inversify';

import {
  Transaction,
  TRANSACTION_STATUS_PENDING,
  TRANSACTION_STATUS_CONFIRMED,
  TRANSACTION_STATUS_FAILED
} from '../../entities/transaction';
import { User } from '../../entities/user';

const DIRECTION_IN = 'in';
const DIRECTION_OUT = 'out';

/**
 *
 */
interface ExtendedTransaction extends Transaction {
  direction: string;
}

/**
 *
 */
export interface TransactionRepositoryInterface {
  newTransaction(): Transaction;
  save(tx: Transaction): Promise<Transaction>;
  getAllByUserAndStatusIn(user: User, statuses: string[], types: string[]): Promise<ExtendedTransaction[]>;
  getByHash(transactionHash: string): Promise<Transaction>;
  getByVerificationId(verificationId: string): Promise<Transaction>;
}

export function allStatusesWithoutUnconfirmed() {
  return [
    TRANSACTION_STATUS_PENDING,
    TRANSACTION_STATUS_CONFIRMED,
    TRANSACTION_STATUS_FAILED
  ];
}

/**
 *
 */
@injectable()
export class TransactionRepository implements TransactionRepositoryInterface {
  /**
   *
   */
  newTransaction(): Transaction {
    return getConnection().getMongoRepository(Transaction).create();
  }

  /**
   *
   * @param tx
   */
  save(tx: Transaction): Promise<Transaction> {
    return getConnection().getMongoRepository(Transaction).save(tx);
  }

  /**
   *
   * @param user
   * @param statuses
   * @param types
   */
  async getAllByUserAndStatusIn(user: User, statuses: string[], types: string[]): Promise<ExtendedTransaction[]> {
    const data = await getMongoManager().createEntityCursor(Transaction, {
      $and: [
        {
          $or: [
            {
              from: user.wallet.address
            },
            {
              to: user.wallet.address
            }
          ]
        },
        {
          status: {
            $in: statuses
          }
        },
        {
          type: {
            $in: types
          }
        }
      ]
    }).toArray() as ExtendedTransaction[];

    for (let transaction of data) {
      if (transaction.from === user.wallet.address) {
        transaction.direction = DIRECTION_OUT;
      } else {
        transaction.direction = DIRECTION_IN;
      }
      delete transaction.verification;
    }

    return data;
  }

  /**
   *
   * @param transactionHash
   */
  getByHash(transactionHash: string): Promise<Transaction> {
    const txRepo = getConnection().getMongoRepository(Transaction);
    return txRepo.findOne({
      transactionHash
    });
  }

  /**
   *
   * @param verificationId
   */
  async getByVerificationId(verificationId: string): Promise<Transaction> {
    const result = await getConnection().getMongoRepository(Transaction).createEntityCursor({
      'verification.id': verificationId
    }).toArray();

    return result.pop();
  }
}

const TransactionRepositoryType = Symbol('TransactionRepositoryInterface');
export { TransactionRepositoryType };
