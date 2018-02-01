import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';
import { Token } from './token';
import { toEthChecksumAddress } from '../services/crypto';

@Entity()
@Index('registered_token_caddr', () => ({
  contractAddress: 1
}), { unique: true })
export class RegisteredToken {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  contractAddress: string;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column()
  decimals: number;

  @Column()
  scope: string;

  @Column()
  createdAt: number;

  static createRegisteredToken(data: any) {
    const t = new RegisteredToken();
    t.contractAddress = toEthChecksumAddress(data.contractAddress);
    t.symbol = data.symbol;
    t.decimals = data.decimals || 18;
    t.name = data.name || '';
    t.scope = '';
    t.createdAt = ~~(+new Date() / 1000);
    return t;
  }
}
