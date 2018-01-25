import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';
import { Verification } from './verification';

export const TRANSACTION_STATUS_UNCONFIRMED = 'unconfirmed';
export const TRANSACTION_STATUS_PENDING = 'pending';
export const TRANSACTION_STATUS_CONFIRMED = 'confirmed';
export const TRANSACTION_STATUS_FAILED = 'failed';

export const ETHEREUM_TRANSFER = 'eth_transfer';
export const ERC20_TRANSFER = 'erc20_transfer';

@Entity()
@Index('txs_hash_type_from_to', () => ({
  transactionHash: 1,
  type: 1,
  from: 1,
  to: 1
}))
@Index('txs_block_height', () => ({
  blockNumber: -1
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

  @Column()
  data: string;

  @Column(type => Verification)
  verification: Verification;
}
