import * as chai from 'chai';
import * as TypeMoq from 'typemoq';

require('../../../../../test/load.fixtures');

import { container } from '../../../../ioc.container';
import { User } from '../../../../entities/user';
import { getMongoRepository } from 'typeorm';
import { EncodedTransaction } from 'web3/types';
import Contract, { DummyContract } from '../../../external/web3.contract';
import { UserPasswordApplicationType, UserPasswordApplication } from '../user.password.app';
import { VerifyActionService, VerifyActionServiceType } from '../../../external/verify.action.service';
import { AuthClientInterface, AuthClientType, AuthClient } from '../../../external/auth.client';
import { InvalidPassword, UserNotFound } from '../../../../exceptions';
import { base64encode } from '../../../../helpers/helpers';

const { expect } = chai;

describe('User Password App', () => {
  let user: User;
  let userPassword: UserPasswordApplication;
  let authMock: TypeMoq.IMock<AuthClientInterface>;
  const newTokenName = 'new_token';
  const userPaymentPassword = '1q@W3e$R5';
  const userCredentialParams = {
    email: 'user1@USER.COM',
    password: '123qweASD!@#'
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
      accessToken: newTokenName
    }));

    userPassword = container.get<UserPasswordApplication>(UserPasswordApplicationType);
  });

  afterEach(() => {
    container.get<VerifyActionService>(VerifyActionServiceType)['redisClient'].quit();
    container.restore();
  });

  it('should get instance', () => {
    expect(userPassword).is.instanceof(UserPasswordApplication);
  });

  it('should success change password', async () => {
    const verify = await userPassword.initiateChangePassword(user, {
      oldPassword: userCredentialParams.password,
      newPassword: 'qwerQWER!@#$123456'
    });

    expect(verify.verification).is.not.empty;

    const result = await userPassword.verifyChangePassword(user, verify as any);

    expect(result.accessToken).is.equal(newTokenName);

    const changedVerify = await userPassword.initiateChangePassword(user, {
      oldPassword: 'qwerQWER!@#$123456',
      newPassword: userCredentialParams.password
    });

    expect(changedVerify.verification).is.not.empty;
  });

  it('should fail change password with invalid password', async () => {
    expect(userPassword.initiateChangePassword(user, {
      oldPassword: 'invalid_password',
      newPassword: 'qwerQWER!@#$123456'
    })).to.be.rejectedWith(InvalidPassword);
  });

  async function initVerifyResetPassword() {
    const verify = await userPassword.initiateResetPassword({
      email: userCredentialParams.email
    });
    expect(verify.verification).is.not.empty;

    const resultData = await userPassword.verifyResetPassword({
      email: user.email,
      verification: verify.verification as any
    });
    expect(resultData.resetId).is.not.empty;

    return resultData;
  }

  it('should fail reset password with invalid email', async () => {
    expect(userPassword.initiateResetPassword({
      email: 'notfound@email.com'
    })).to.be.rejectedWith(UserNotFound);
  });

  it('should fail reset password with invalid resetId', async () => {
    await initVerifyResetPassword();

    expect(userPassword.resetPasswordEnter({
      email: user.email,
      resetId: base64encode('invalid_resetId'),
      password: '123456'
    })).to.be.rejectedWith(UserNotFound);
  });

  it('should success reset password', async () => {
    const resultData = await initVerifyResetPassword();

    const resultReset = await userPassword.resetPasswordEnter({
      email: user.email,
      resetId: resultData.resetId,
      password: '123456'
    });
    expect(resultReset.isReset).is.true;
  });

  it('should fail to change to new paymentPassword with invalid old paymentPassword', async () => {
    expect(userPassword.initiateChangePaymentPassword(user, {
      oldPaymentPassword: 'invalid_payment_password',
      newPaymentPassword: 'new_payment_password'
    })).to.be.rejectedWith(InvalidPassword);
  });

  it('should change paymentPassword', async () => {
    const verifyData = await userPassword.initiateChangePaymentPassword(user, {
      oldPaymentPassword: userPaymentPassword,
      newPaymentPassword: '32$%^QWEqwe'
    });

    expect(verifyData.verification).is.not.undefined;

    const resultData = await userPassword.verifyChangePaymentPassword(user, verifyData as any);

    expect(resultData.isChanged).is.true;

    const verifyAgainData = await userPassword.initiateChangePaymentPassword(user, {
      oldPaymentPassword: '32$%^QWEqwe',
      newPaymentPassword: userPaymentPassword
    });

    expect(verifyData.verification).is.not.undefined;
  });
});
