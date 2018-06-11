import * as chai from 'chai';
import * as TypeMoq from 'typemoq';

require('../../../../../test/load.fixtures');

import { container } from '../../../../ioc.container';
import { User } from '../../../../entities/user';
import { getMongoRepository, ObjectID } from 'typeorm';
import { EncodedTransaction } from 'web3/types';
import Contract, { DummyContract } from '../../../external/web3.contract';
import { UserAccountApplicationType, UserAccountApplication, UserAccountApplicationType } from '../user.account.app';
import { VerifyActionService, VerifyActionServiceType, Verifications } from '../../../external/verify.action.service';
import { UserExists, InvalidPassword, UserNotFound, IncorrectMnemonic } from '../../../../exceptions';
import { VerifiedToken } from '../../../../entities/verified.token';
import { AuthClientInterface, AuthClient, AuthClientType } from '../../../external/auth.client';
import { Notifications } from '../../../../entities/preferences';

const { expect } = chai;

describe('User Account App', () => {
  let user: User;
  let authMock: TypeMoq.IMock<AuthClientInterface>;
  let userAccount: UserAccountApplication;
  let userAccountMock: TypeMoq.IMock<UserAccountApplication>;
  let userAccountForFirstWallet: UserAccountApplication;
  const userPaymentPassword = '1q@W3e$R5';
  const existingUserParams = {
    email: 'user1@USER.COM',
    name: 'User name',
    password: 'password',
    paymentPassword: 'password2',
    agreeTos: true
  };
  const inputWalletData: InputWallet = {
    name: 'some wallet name',
    color: '#F3F4F5'
  };
  const inputWalletUpdateData: InputWallet = {
    name: 'New wallet name',
    color: '#C32333'
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

    userAccountMock = TypeMoq.Mock.ofType<UserAccountApplication>(UserAccountApplication);
    container.rebind<UserAccountApplication>(UserAccountApplicationType).toConstantValue(userAccountMock.object);
    userAccountForFirstWallet = container.get<UserAccountApplication>(UserAccountApplicationType);

    userAccountMock.setup((x) => x.createAndAddNewWallet(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(async () => ({
      ticker: 'ETH',
      balance: '0.1'
    }));
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
    const verifyInit = await userAccount.initiateSetVerifications(user, {
      [Verifications.USER_CHANGE_PASSWORD]: true,
      [Verifications.USER_SIGNIN]: false
    });

    expect(verifyInit).is.not.empty;
    expect(verifyInit.verification.verificationId).is.not.empty;

    const { verifications } = await userAccount.verifySetVerifications(user, { verification: verifyInit.verification });

    expect(verifications[Verifications.TRANSACTION_SEND]).is.true;
    expect(verifications[Verifications.USER_CHANGE_PASSWORD]).is.true;
    expect(verifications[Verifications.USER_SIGNIN]).is.false;
  });

  it('should fail to create a new wallet with invalid payment password', async () => {
    expect(userAccount
      .createAndAddNewWallet(user, 'ETH', 'invalid_payment_password')
    ).to.be.rejectedWith(IncorrectMnemonic);
  });

  it('should create a new wallet', async () => {
    const newWallet = await userAccount.createAndAddNewWallet(user, 'ETH', userPaymentPassword, inputWalletData);

    expect(newWallet.ticker).is.equal('ETH');
    expect(newWallet.name).is.equal(inputWalletData.name);
    expect(newWallet.color).is.equal(inputWalletData.color);

    const refreshedUser = await getMongoRepository(User).findOne({ email: 'user1@user.com' });

    expect(refreshedUser.wallets[1].address).is.equal(newWallet.address);
    expect(refreshedUser.wallets[1].name).is.equal(newWallet.name);
    expect(refreshedUser.wallets[1].color).is.equal(newWallet.color);
  });

  it('should update wallet', async () => {
    const newWallet = await userAccount.createAndAddNewWallet(user, 'ETH', userPaymentPassword, inputWalletData);
    inputWalletUpdateData.address = newWallet.address;

    const updatedWallet = await userAccount.updateWallet(user, inputWalletUpdateData);

    expect(updatedWallet.address).is.equal(inputWalletUpdateData.address);
    expect(updatedWallet.name).is.equal(inputWalletUpdateData.name);
    expect(updatedWallet.color).is.equal(inputWalletUpdateData.color);

    const refreshedUser = await getMongoRepository(User).findOne({ email: 'user1@user.com' });

    expect(refreshedUser.wallets[1].address).is.equal(updatedWallet.address);
    expect(refreshedUser.wallets[1].name).is.equal(updatedWallet.name);
    expect(refreshedUser.wallets[1].color).is.equal(updatedWallet.color);
  });

  it('should create a first wallet with balance 0.1 test ETH', async () => {
    const newWallet = await userAccountForFirstWallet.createAndAddNewWallet(user, 'ETH', userPaymentPassword, inputWalletData);

    expect(newWallet.balance).is.equal('0.1');
  });
});
