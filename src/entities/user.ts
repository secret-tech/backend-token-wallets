import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';

import { Wallet } from './wallet';
import { base64encode } from '../helpers/helpers';
import { Preferences, Notifications } from './preferences';
import { Verifications, VerifyMethod } from '../services/external/verify.action.service';

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
    user.preferences = new Preferences();
    return user;
  }

  addWallet(wallet: Wallet) {
    this.wallets = this.wallets || [];
    if (!this.wallets.filter(w => w.ticker.toLowerCase() !== wallet.ticker.toLowerCase() &&
      w.address.toLowerCase() !== wallet.address.toLowerCase()).length) {
      this.wallets.push(wallet);
    }
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
}
