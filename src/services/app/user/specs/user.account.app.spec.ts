import * as chai from 'chai';
import * as TypeMoq from 'typemoq';

require('../../../../../test/load.fixtures');

import { container } from '../../../../ioc.container';
import { User } from '../../../../entities/user';
import { getMongoRepository, ObjectID } from 'typeorm';
import { EncodedTransaction } from 'web3/types';
import Contract, { DummyContract } from '../../../external/web3.contract';
import { UserAccountApplicationType, UserAccountApplication } from '../user.account.app';
import { VerifyActionService, VerifyActionServiceType, Verifications } from '../../../external/verify.action.service';
import { UserExists, InvalidPassword, UserNotFound } from '../../../../exceptions';
import { VerifiedToken } from '../../../../entities/verified.token';
import { AuthClientInterface, AuthClient, AuthClientType } from '../../../external/auth.client';
import { Notifications } from '../../../../entities/preferences';

const { expect } = chai;

describe('User Account App', () => {
  let user: User;
  let authMock: TypeMoq.IMock<AuthClientInterface>;
  let userAccount: UserAccountApplication;
  const existingUserParams = {
    email: 'user1@USER.COM',
    name: 'User name',
    password: 'password',
    paymentPassword: 'password2',
    agreeTos: true
  };

  beforeEach(async () => {
    user = await getMongoRepository(User).findOne({ email: 'user1@user.com' });
    container.snapshot();

    authMock = TypeMoq.Mock.ofType<AuthClientInterface>(AuthClient);
    container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);

    authMock.setup((x) => x.createUser(TypeMoq.It.isAny())).returns(async () => ({
      id: '', email: '', login: '', sub: '', tenant: ''
    }));

    authMock.setup((x) => x.loginUser(TypeMoq.It.isAny())).returns(async () => ({
      accessToken: 'new_token'
    }));

    userAccount = container.get<UserAccountApplication>(UserAccountApplicationType);
  });

  afterEach(() => {
    container.get<VerifyActionService>(VerifyActionServiceType)['redisClient'].quit();
    container.restore();
  });

  it('should get instance', () => {
    expect(userAccount).is.instanceof(UserAccountApplication);
  });

  it('should failed to register existing user', async () => {
    expect(userAccount.create(existingUserParams)).to.be.rejectedWith(UserExists);
  });

  it('should register a new user', async () => {
    const user = await userAccount.create({
      ...existingUserParams,
      email: 'user2@USER.COM'
    });

    expect(user.verification).is.not.empty;

    const result = await userAccount.activate({ verification: user.verification as any });

    expect(result.accessToken).is.not.empty;
    expect(result.wallets.length).is.equal(1);
  });

  it('should success login user', async () => {
    const userForLogin = await userAccount.initiateLogin({
      email: 'user1@USER.COM',
      password: '123qweASD!@#'
    }, '127.0.0.1');

    expect(userForLogin.verification).is.not.empty;

    const result = await userAccount.verifyLogin({ verification: userForLogin.verification as any });

    expect(result.accessToken).is.not.empty;
  });

  it('should fail login with invalid password', async () => {
    expect(userAccount.initiateLogin({
      email: 'user1@USER.COM',
      password: 'invalid_password'
    }, '127.0.0.1')).to.be.rejectedWith(InvalidPassword);
  });

  it('should fail login with invalid email', async () => {
    expect(userAccount.initiateLogin({
      email: 'user1@USER_invalid.COM',
      password: 'invalid_password'
    }, '127.0.0.1')).to.be.rejectedWith(UserNotFound);
  });

  it('should set notifications', async () => {
    const { notifications } = await userAccount.setNotifications(user, {
      [Notifications.USER_SIGNIN]: true,
      [Notifications.USER_CHANGE_PASSWORD]: false
    });

    expect(notifications[Notifications.USER_SIGNIN]).is.true;
    expect(notifications[Notifications.USER_RESET_PASSWORD]).is.true;
    expect(notifications[Notifications.USER_CHANGE_PASSWORD]).is.false;
  });

  it('should success set verifications', async () => {
    const userVerify = await userAccount.initiateSetVerifications(user, {
      [Verifications.USER_CHANGE_PASSWORD]: true,
      [Verifications.USER_SIGNIN]: false
    });

    expect(userVerify).is.not.empty;

    const { verifications } = await userAccount.verifySetVerifications(user, { verification: userVerify as any });

    expect(verifications[Verifications.TRANSACTION_SEND]).is.true;
    expect(verifications[Verifications.USER_CHANGE_PASSWORD]).is.true;
    expect(verifications[Verifications.USER_SIGNIN]).is.false;
  });
});
