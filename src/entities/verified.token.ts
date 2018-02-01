import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { User } from './user';

@Entity()
export class VerifiedToken {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  userId: ObjectID;

  @Column()
  token: string;

  @Column()
  verified: boolean;

  @Column()
  createdAt: number;

  static createNotVerifiedToken(user: User, token: string) {
    const verifiedToken = new VerifiedToken();
    verifiedToken.userId = user.id;
    verifiedToken.createdAt = ~~(+new Date() / 1000);
    verifiedToken.token = token;
    verifiedToken.verified = false;
    return verifiedToken;
  }

  static createVerifiedToken(user: User, token: string) {
    const verifiedToken = new VerifiedToken();
    verifiedToken.userId = user.id;
    verifiedToken.createdAt = ~~(+new Date() / 1000);
    verifiedToken.token = token;
    verifiedToken.verified = true;
    return verifiedToken;
  }

  makeVerified() {
    if (this.verified) {
      throw Error('Token is verified already');
    }

    this.verified = true;
  }
}
