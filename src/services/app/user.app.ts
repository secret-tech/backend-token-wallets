import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';

import config from '../../config';

import { AuthClientType, AuthClientInterface } from '../external/auth.client';
import { VerificationClientType, VerificationClientInterface } from '../external/verify.client';
import { Web3ClientType, Web3ClientInterface } from '../external/web3.client';
import { EmailQueueType, EmailQueueInterface } from '../queues/email.queue';

import initiateSignUpTemplate from '../../resources/emails/1_initiate_signup';
import successSignUpTemplate from '../../resources/emails/2_success_signup';
import initiateSignInCodeTemplate from '../../resources/emails/3_initiate_signin_code';
import successSignInTemplate from '../../resources/emails/5_success_signin';
import initiatePasswordResetTemplate from '../../resources/emails/6_initiate_password_reset_code';
import successPasswordResetTemplate from '../../resources/emails/8_success_password_reset';
import initiatePasswordChangeTemplate from '../../resources/emails/27_initiate_password_change_code';
import successPasswordChangeTemplate from '../../resources/emails/28_success_password_change';

import {
  UserExists,
  UserNotFound,
  InvalidPassword,
  UserNotActivated,
  TokenNotFound, AuthenticatorError
} from '../../exceptions';
import { User } from '../../entities/user';
import { VerifiedToken } from '../../entities/verified.token';
import { AUTHENTICATOR_VERIFICATION, EMAIL_VERIFICATION } from '../../entities/verification';
import * as transformers from './transformers';
import { generateMnemonic } from '../crypto';
import { Logger } from '../../logger';

export const ACTIVATE_USER_SCOPE = 'activate_user';
export const LOGIN_USER_SCOPE = 'login_user';
export const CHANGE_PASSWORD_SCOPE = 'change_password';
export const RESET_PASSWORD_SCOPE = 'reset_password';
export const ENABLE_2FA_SCOPE = 'enable_2fa';
export const DISABLE_2FA_SCOPE = 'disable_2fa';

/**
 * UserApplication
 */
@injectable()
export class UserApplication {
  private logger = Logger.getInstance('USER_APP');

  /**
   * constructor
   *
   * @param  authClient  auth service client
   * @param  verificationClient  verification service client
   * @param  web3Client web3 service client
   * @param  emailQueue email queue
   */
  constructor(
    @inject(AuthClientType) private authClient: AuthClientInterface,
    @inject(VerificationClientType) private verificationClient: VerificationClientInterface,
    @inject(Web3ClientType) private web3Client: Web3ClientInterface,
    @inject(EmailQueueType) private emailQueue: EmailQueueInterface
  ) { }

  /**
   * Save user's data
   *
   * @param userData user info
   * @return promise
   */
  async create(userData: InputUserData): Promise<CreatedUserData> {
    const { email } = userData;
    const existingUser = await getConnection().getMongoRepository(User).findOne({
      email: email
    });

    if (existingUser) {
      throw new UserExists('User already exists');
    }

    this.logger.debug('Create and initiate verification', email);

    const encodedEmail = encodeURIComponent(email);
    const link = `${config.app.frontendPrefixUrl}/auth/signup?type=activate&code={{{CODE}}}&verificationId={{{VERIFICATION_ID}}}&email=${encodedEmail}`;
    const verification = await this.verificationClient.initiateVerification(EMAIL_VERIFICATION, {
      consumer: email,
      issuer: 'Jincor',
      template: {
        fromEmail: config.email.from.general,
        subject: 'Verify your email at Jincor.com',
        body: initiateSignUpTemplate(userData.name, link)
      },
      generateCode: {
        length: 6,
        symbolSet: [
          'DIGITS'
        ]
      },
      policy: {
        expiredOn: '24:00:00'
      },
      payload: {
        scope: ACTIVATE_USER_SCOPE
      }
    });

    userData.passwordHash = bcrypt.hashSync(userData.password);
    const user = User.createUser(userData, {
      verificationId: verification.verificationId
    });

    this.logger.debug('Save new user in db', email);

    await getConnection().mongoManager.save(user);

    this.logger.debug('Register new user in auth service', email);

    await this.authClient.createUser(transformers.transformUserForAuth(user));

    return transformers.transformCreatedUser(user);
  }

  /**
   * Save user's data
   *
   * @param loginData user info
   * @param ip string
   * @return promise
   */
  async initiateLogin(loginData: InitiateLoginInput, ip: string): Promise<InitiateLoginResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: loginData.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    if (!user.isVerified) {
      throw new UserNotActivated('Account is not activated! Please check your email.');
    }

    const passwordMatch = bcrypt.compareSync(loginData.password, user.passwordHash);

    if (!passwordMatch) {
      throw new InvalidPassword('Incorrect password');
    }

    this.logger.debug('Login in auth service', user.email);

    const tokenData = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    this.logger.debug('Initiate login', user.email);

    const verificationData = await this.verificationClient.initiateVerification(
      user.defaultVerificationMethod,
      {
        consumer: user.email,
        issuer: 'Jincor',
        template: {
          fromEmail: config.email.from.general,
          subject: 'Jincor.com Login Verification Code',
          body: initiateSignInCodeTemplate(user.name, new Date().toUTCString(), ip)
        },
        generateCode: {
          length: 6,
          symbolSet: ['DIGITS']
        },
        policy: {
          expiredOn: '01:00:00'
        },
        payload: {
          scope: LOGIN_USER_SCOPE
        }
      }
    );

    const token = VerifiedToken.createNotVerifiedToken(
      tokenData.accessToken,
      verificationData
    );

    this.logger.debug('Save login user verification token', user.email);

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    return {
      accessToken: tokenData.accessToken,
      isVerified: false,
      verification: verificationData
    };
  }

  /**
   * Verify login
   *
   * @param inputData user info
   * @return promise
   */
  async verifyLogin(inputData: VerifyLoginInput): Promise<VerifyLoginResult> {
    const token = await getConnection().getMongoRepository(VerifiedToken).findOne({
      token: inputData.accessToken
    });

    if (!token) {
      throw new TokenNotFound('Token is not found');
    }

    if (token.verification.id !== inputData.verification.id) {
      throw new Error('Invalid verification id');
    }

    this.logger.debug('Verify login user token');

    const verifyAuthResult = await this.authClient.verifyUserToken(inputData.accessToken);

    this.logger.debug('Save verified login user', verifyAuthResult.login);

    const user = await getConnection().getMongoRepository(User).findOne({
      email: verifyAuthResult.login
    });

    const inputVerification = {
      verificationId: inputData.verification.id,
      code: inputData.verification.code,
      method: inputData.verification.method
    };

    const payload = {
      scope: LOGIN_USER_SCOPE
    };

    this.logger.debug('Verify login user', verifyAuthResult.login);

    await this.verificationClient.validateVerification(
      inputData.verification.method,
      inputVerification.verificationId,
      inputVerification
    );

    token.makeVerified();

    this.logger.debug('Save verified login token', verifyAuthResult.login);

    await getConnection().getMongoRepository(VerifiedToken).save(token);
    this.emailQueue.addJob({
      sender: config.email.from.general,
      subject: 'Jincor.com Successful Login Notification',
      recipient: user.email,
      text: successSignInTemplate(user.name, new Date().toUTCString())
    });
    return transformers.transformVerifiedToken(token);
  }

  /**
   *
   * @param activationData
   */
  async activate(activationData: ActivationUserData): Promise<ActivationResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: activationData.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    if (user.isVerified) {
      throw Error('User is activated already');
    }

    const inputVerification = {
      verificationId: activationData.verificationId,
      method: EMAIL_VERIFICATION,
      code: activationData.code
    };

    const payload = {
      scope: ACTIVATE_USER_SCOPE
    };

    this.logger.debug('Verify and activate user', user.email);

    await this.verificationClient.validateVerification(
      inputVerification.method,
      inputVerification.verificationId,
      inputVerification
    );

    const mnemonic = generateMnemonic();
    const salt = bcrypt.genSaltSync();
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt);

    user.addWallet({
      ticker: 'ETH',
      address: account.address,
      balance: '0',
      salt
    });

    user.isVerified = true;

    this.logger.debug('Save activated user', user.email);

    await getConnection().getMongoRepository(User).save(user);

    this.logger.debug('Get auth token for activated user', user.email);

    const loginResult = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    const resultWallets: Array<NewWallet> = [
      {
        ticker: 'ETH',
        address: account.address,
        balance: '0',
        mnemonic: mnemonic,
        privateKey: account.privateKey
      }
    ];

    const token = VerifiedToken.createVerifiedToken(loginResult.accessToken);

    this.logger.debug('Save verified token for activated user', user.email);

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    this.emailQueue.addJob({
      sender: config.email.from.general,
      recipient: user.email,
      subject: 'You are officially registered for participation in Jincor\'s ICO',
      text: successSignUpTemplate(user.name)
    });

    return {
      accessToken: loginResult.accessToken,
      wallets: resultWallets
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async initiateChangePassword(user: User, params: any): Promise<BaseInitiateResult> {
    if (!bcrypt.compareSync(params.oldPassword, user.passwordHash)) {
      throw new InvalidPassword('Invalid password');
    }

    this.logger.debug('Initiate changing password', user.email);

    const verificationData = await this.verificationClient.initiateVerification(
      user.defaultVerificationMethod,
      {
        consumer: user.email,
        issuer: 'Jincor',
        template: {
          fromEmail: config.email.from.general,
          subject: 'Here’s the Code to Change Your Password at Jincor.com',
          body: initiatePasswordChangeTemplate(user.name)
        },
        generateCode: {
          length: 6,
          symbolSet: ['DIGITS']
        },
        policy: {
          expiredOn: '24:00:00'
        },
        payload: {
          scope: CHANGE_PASSWORD_SCOPE
        }
      }
    );

    return {
      verification: verificationData
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyChangePassword(user: User, params: any): Promise<AccessTokenResponse> {
    if (!bcrypt.compareSync(params.oldPassword, user.passwordHash)) {
      throw new InvalidPassword('Invalid password');
    }

    const payload = {
      scope: CHANGE_PASSWORD_SCOPE
    };

    this.logger.debug('Verify atempt to change password', user.email);

    await this.verificationClient.validateVerification(
      'email',
      params.verification.verificationId,
      params.verification
    );

    user.passwordHash = bcrypt.hashSync(params.newPassword);

    this.logger.debug('Save changed password', user.email);

    await getConnection().getMongoRepository(User).save(user);

    this.emailQueue.addJob({
      sender: config.email.from.general,
      recipient: user.email,
      subject: 'Jincor.com Password Change Notification',
      text: successPasswordChangeTemplate(user.name)
    });

    this.logger.debug('Recreate user with changed password in auth', user.email);

    await this.authClient.createUser({
      email: user.email,
      login: user.email,
      password: user.passwordHash,
      sub: params.verification.verificationId
    });

    this.logger.debug('Reauth user to get auth token after changing password', user.email);

    const loginResult = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    const token = VerifiedToken.createVerifiedToken(loginResult.accessToken);

    this.logger.debug('Save verified token with changed password', user.email);

    await getConnection().getMongoRepository(VerifiedToken).save(token);
    return loginResult;
  }

  /**
   *
   * @param params
   */
  async initiateResetPassword(params: ResetPasswordInput): Promise<BaseInitiateResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    this.logger.debug('Initiate reset password', user.email);

    const verificationData = await this.verificationClient.initiateVerification(
      user.defaultVerificationMethod,
      {
        consumer: user.email,
        issuer: 'Jincor',
        template: {
          fromEmail: config.email.from.general,
          body: initiatePasswordResetTemplate(user.name),
          subject: 'Here’s the Code to Reset Your Password at Jincor.com'
        },
        generateCode: {
          length: 6,
          symbolSet: ['DIGITS']
        },
        policy: {
          expiredOn: '24:00:00'
        },
        payload: {
          scope: RESET_PASSWORD_SCOPE
        }
      }
    );

    return {
      verification: verificationData
    };
  }

  /**
   *
   * @param params
   */
  async verifyResetPassword(params: ResetPasswordInput): Promise<ValidationResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    const payload = {
      scope: RESET_PASSWORD_SCOPE
    };

    this.logger.debug('Verify attempt to reset password', user.email);

    const verificationResult = await this.verificationClient.validateVerification(
      'email',
      params.verification.verificationId,
      params.verification
    );

    user.passwordHash = bcrypt.hashSync(params.password);

    this.logger.debug('Save user with new reset password', user.email);

    await getConnection().getMongoRepository(User).save(user);

    this.logger.debug('Reauth user to get new auth token after reset password', user.email);

    await this.authClient.createUser({
      email: user.email,
      login: user.email,
      password: user.passwordHash,
      sub: params.verification.verificationId
    });

    this.emailQueue.addJob({
      sender: config.email.from.general,
      recipient: user.email,
      subject: 'Jincor.com Password Reset Notification',
      text: successPasswordResetTemplate(user.name)
    });

    return verificationResult;
  }

  private async initiate2faVerification(user: User, scope: string): Promise<InitiateResult> {
    this.logger.debug('Initiate 2fa', user.email);

    return this.verificationClient.initiateVerification(
      AUTHENTICATOR_VERIFICATION,
      {
        consumer: user.email,
        issuer: 'Jincor',
        policy: {
          expiredOn: '01:00:00'
        },
        payload: {
          scope
        }
      }
    );
  }

  /**
   *
   * @param user
   */
  async initiateEnable2fa(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod === AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is enabled already.');
    }

    this.logger.debug('Initiate to enable 2fa', user.email);

    return {
      verification: await this.initiate2faVerification(user, ENABLE_2FA_SCOPE)
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyEnable2fa(user: User, params: VerificationInput): Promise<Enable2faResult> {
    if (user.defaultVerificationMethod === AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is enabled already.');
    }

    const payload = {
      scope: ENABLE_2FA_SCOPE
    };

    this.logger.debug('Verify attempt to enable 2fa', user.email);

    await this.verificationClient.validateVerification(
      'email',
      params.verification.verificationId,
      params.verification
    );

    user.defaultVerificationMethod = AUTHENTICATOR_VERIFICATION;

    this.logger.debug('Save enabled 2fa', user.email);

    await getConnection().getMongoRepository(User).save(user);

    return {
      enabled: true
    };
  }

  /**
   *
   * @param user
   */
  async initiateDisable2fa(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod !== AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is disabled already.');
    }

    this.logger.debug('Initiate disable 2fa', user.email);

    return {
      verification: await this.initiate2faVerification(user, DISABLE_2FA_SCOPE)
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyDisable2fa(user: User, params: VerificationInput): Promise<Enable2faResult> {
    if (user.defaultVerificationMethod !== AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is disabled already.');
    }

    const payload = {
      scope: DISABLE_2FA_SCOPE
    };

    this.logger.debug('Verify attempt to disable 2fa', user.email);

    await this.verificationClient.validateVerification(
      AUTHENTICATOR_VERIFICATION,
      params.verification.verificationId,
      { code: params.verification.code, removeSecret: true }
    );

    user.defaultVerificationMethod = EMAIL_VERIFICATION;

    this.logger.debug('Save disabled 2fa', user.email);

    await getConnection().getMongoRepository(User).save(user);

    return {
      enabled: false
    };
  }

  /**
   *
   * @param user
   */
  async getUserInfo(user: User): Promise<UserInfo> {
    return {
      ethAddress: user.wallet.address,
      email: user.email,
      name: user.name,
      defaultVerificationMethod: user.defaultVerificationMethod
    };
  }
}

const UserApplicationType = Symbol('UserApplicationInterface');
export { UserApplicationType };
