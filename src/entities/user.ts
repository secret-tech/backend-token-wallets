import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';

import { Wallet } from './wallet';
import { base64encode } from '../helpers/helpers';
import { VerifyMethod } from './verify.action';

@Entity()
@Index('user_email', () => ({
  email: 1
}), { unique: true })
@Index('user_wallets', () => ({
  'wallets.address': 1
}), { unique: true })
export class User {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  passwordHash: string;

  @Column()
  agreeTos: boolean;

  @Column()
  isVerified: boolean;

  @Column()
  defaultVerificationMethod: string;

  @Column()
  source: any;

  @Column(type => Wallet)
  wallets: Wallet[];

  @Column()
  createdAt: number;

  static createUser(data: any) {
    const user = new User();
    user.wallets = data.wallets || [];
    user.email = data.email;
    user.name = data.name;
    user.agreeTos = data.agreeTos || false;
    user.passwordHash = data.passwordHash;
    user.isVerified = false;
    user.defaultVerificationMethod = VerifyMethod.EMAIL;
    user.source = data.source || 'unknown';
    user.createdAt = ~~(+new Date() / 1000);
    return user;
  }

  addWallet(wallet: Wallet) {
    this.wallets = this.wallets || [];
    if (!this.wallets.filter(w => w.ticker.toLowerCase() != wallet.ticker.toLowerCase() &&
      w.address.toLowerCase() != wallet.address.toLowerCase()).length) {
      this.wallets.push(wallet);
    }
  }
}
