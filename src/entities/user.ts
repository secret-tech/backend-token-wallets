import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';

import { Verification, EMAIL_VERIFICATION } from './verification';
import { Wallet } from './wallet';
import { base64encode } from '../helpers/helpers';

@Entity()
@Index('user_email', () => ({
  email: 1
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

  @Column(type => Verification)
  verification: Verification;

  @Column(type => Wallet)
  wallet: Wallet;

  static createUser(data: UserData, verification) {
    const user = new User();
    user.email = data.email;
    user.name = data.name;
    user.agreeTos = data.agreeTos;
    user.passwordHash = data.passwordHash;
    user.isVerified = false;
    user.defaultVerificationMethod = EMAIL_VERIFICATION;
    user.verification = Verification.createVerification({
      verificationId: verification.verificationId,
      method: EMAIL_VERIFICATION
    });
    user.source = data.source;
    return user;
  }

  addWallet(data: any) {
    this.wallet = Wallet.createWallet(data);
  }
}
