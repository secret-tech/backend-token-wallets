import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';
import { toEthChecksumAddress } from '../services/crypto';

export const TRANSACTION_STATUS_PENDING = 'pending';
export const TRANSACTION_STATUS_CONFIRMED = 'confirmed';
export const TRANSACTION_STATUS_FAILED = 'failed';

export const ETHEREUM_TRANSFER = 'eth_transfer';
export const ERC20_TRANSFER = 'erc20_transfer';

@Entity()
@Index('txs_from', () => ({
  from: 1
}))
@Index('txs_to', () => ({
  to: 1
}))
@Index('txs_hash', () => ({
  transactionHash: 1
}))
@Index('txs_timestamp', () => ({
  timestamp: -1
}))
export class Transaction {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  transactionHash: string;

  @Column()
  timestamp: number;

  @Column()
  blockNumber: number;

  @Column()
  contractAddress: string;

  @Column()
  type: string;

  @Column()
  from: string;

  @Column()
  to: string;

  @Column()
  amount: string;

  @Column()
  status: string;

  @Column()
  details: string;

  static createTransaction(data: any) {
    const tx = new Transaction();

    tx.transactionHash = data.transactionHash;
    tx.contractAddress = data.contractAddress ? toEthChecksumAddress(data.contractAddress) : '';
    tx.type = data.type;
    tx.from = data.from;
    tx.to = data.to;
    tx.amount = data.amount;
    tx.status = data.status;
    tx.details = data.details;

    return tx;
  }
}
