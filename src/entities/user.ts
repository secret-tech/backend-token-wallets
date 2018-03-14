import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';

import { Wallet } from './wallet';
import { base64encode } from '../helpers/helpers';
import { Preferences, Notifications } from './preferences';
import { Verifications, VerifyMethod } from '../services/external/verify.action.service';
import { WalletNotFound } from '../exceptions';

@Entity()
@Index('user_email', () => ({
  email: 1
}), { unique: true })
@Index('user_wallets', () => ({
  'wallets.address': 1
}))
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

  @Column(type => Preferences)
  preferences: Preferences;

  @Column()
  defaultVerificationMethod: string;

  @Column()
  source: any;

  @Column()
  securityKey: string;

  @Column()
  recoveryKey: string;

  @Column()
  salt: string;

  @Column()
  mnemonic: string;

  @Column(type => Wallet)
  wallets: Wallet[];

  @Column()
  createdAt: number;

  static createUser(data: any) {
    const user = new User();
    user.securityKey = data.securityKey;
    user.recoveryKey = data.recoveryKey;
    user.salt = data.salt;
    user.mnemonic = data.mnemonic;
    user.wallets = data.wallets || [];
    user.email = data.email;
    user.name = data.name;
    user.agreeTos = data.agreeTos || false;
    user.passwordHash = data.passwordHash;
    user.isVerified = false;
    user.defaultVerificationMethod = VerifyMethod.EMAIL;
    user.source = data.source || 'unknown';
    user.createdAt = ~~(+new Date() / 1000);
    user.preferences = new Preferences();
    return user;
  }

  addWallet(wallet: Wallet) {
    this.wallets = this.wallets || [];
    if (!this.getWalletByAddress(wallet.address)) {
      this.wallets.push(wallet);
    }
  }

  getWalletByAddress(address: string): Wallet {
    return this.wallets.filter(w => w.address.toLowerCase() === address.toLowerCase()).pop();
  }

  getNextWalletIndex(): number {
    let max = -1;
    this.wallets.forEach((w, i) => max = Math.max(max, i));
    return max + 1;
  }

  isNotificationEnabled(notification: Notifications): boolean {
    return !this.preferences || !this.preferences.notifications ||
      this.preferences.notifications[notification] ||
      this.preferences.notifications[notification] === undefined;
  }

  isVerificationEnabled(verification: Verifications): boolean {
    return !this.preferences || !this.preferences.verifications ||
      this.preferences.verifications[verification] ||
      this.preferences.verifications[verification] === undefined;
  }

  getSingleWalletOrThrowError(): Wallet {
    if (this.wallets.length !== 1) {
      throw new WalletNotFound('Single wallet cant be found, you should obviously specified a wallet address');
    }

    return this.wallets[0];
  }
}
