import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Index } from 'typeorm/decorator/Index';

export enum VerifyMethod {
  AUTHENTICATOR = 'google_auth',
  EMAIL = 'email'
}

// @TODO: Refactor to interface and move it to index.d.ts
export class VerifyAction {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  verificationId: string;

  @Column()
  method: string;

  @Column()
  scope: string;

  @Column()
  expiredOn: number;

  @Column()
  payload: string;

  static createVerification(data: any) {
    const verification = new VerifyAction();
    verification.verificationId = data.verificationId;
    verification.expiredOn = data.expiredOn;
    verification.payload = data.payload;
    verification.scope = data.scope;
    verification.method = data.method;
    return verification;
  }
}
