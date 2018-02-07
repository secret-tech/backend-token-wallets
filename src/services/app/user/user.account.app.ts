import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';

import config from '../../../config';

import { AuthClientType, AuthClientInterface } from '../../external/auth.client';
import { VerificationClientType, VerificationClientInterface } from '../../external/verify.client';
import { Web3ClientType, Web3ClientInterface } from '../../external/web3.client';
import { EmailQueueType, EmailQueueInterface } from '../../queues/email.queue';

import successSignUpTemplate from '../../../resources/emails/2_success_signup';
import successSignInTemplate from '../../../resources/emails/5_success_signin';

import {
  UserExists,
  UserNotFound,
  InvalidPassword,
  TokenNotFound,
  AuthenticatorError
} from '../../../exceptions';
import { User } from '../../../entities/user';
import { VerifiedToken } from '../../../entities/verified.token';
import * as transformers from '../transformers';
import { generateMnemonic, MasterKeySecret, getSha256HexHash, getUserMasterKey, encryptText, getRecoveryMasterKey, decryptTextByRecoveryMasterKey } from '../../crypto';
import { Logger } from '../../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../../repositories/user.repository';
import { RegisteredTokenRepository, RegisteredTokenRepositoryType, RegisteredTokenRepositoryInterface, RegisteredTokenScope } from '../../repositories/registered.tokens.repository';
import { buildScopeEmailVerificationInitiate, buildScopeGoogleAuthVerificationInitiate } from '../../../verify.cases';
import { VerificationInitiateContext } from '../../external/verify.context.service';
import { Wallet } from '../../../entities/wallet';
import { VerifyActionServiceType, VerifyActionService, Verifications, VerifyMethod, getAllVerifications } from '../../external/verify.action.service';
import { Token } from '../../../entities/token';
import { writeFileSync, readFileSync, writeFile } from 'fs';
import { join } from 'path';
import { Notifications, Preferences, getAllNotifications, BooleanState } from '../../../entities/preferences';

/**
 * UserAccountApplication
 */
@injectable()
export class UserAccountApplication {
  private logger = Logger.getInstance('USER_ACCOUNT_APP');

  /**
   * constructor
   */
  constructor(
    @inject(VerifyActionServiceType) private verifyAction: VerifyActionService,
    @inject(AuthClientType) private authClient: AuthClientInterface,
    @inject(UserRepositoryType) private userRepository: UserRepositoryInterface,
    @inject(RegisteredTokenRepositoryType) private tokensRepository: RegisteredTokenRepositoryInterface,
    @inject(Web3ClientType) private web3Client: Web3ClientInterface,
    @inject(EmailQueueType) private emailQueue: EmailQueueInterface
  ) { }

  // @TODO: DRY
  private newInitiateVerification(scope: string, consumer: string) {
    return buildScopeGoogleAuthVerificationInitiate(
      new VerificationInitiateContext(scope), { consumer }
    );
  }

  private async initiateCreateAndReturnUser(user: User, initiateVerification: VerificationInitiateContext) {
    this.logger.debug('Initiate verification for created user', user.email);

    const { verifyInitiated } = await this.verifyAction.initiate(initiateVerification, {
      userEmail: user.email
    });

    return transformers.transformCreatedUser(user, verifyInitiated);
  }

  private createNewWallet(user: User, paymentPassword: string) {
    this.logger.debug('Create new wallet for', user.email);

    const mnemonic = generateMnemonic();
    const salt = bcrypt.genSaltSync();
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt);

    // should be created every time for fresh master key
    const msc = new MasterKeySecret();

    user.addWallet(Wallet.createWallet({
      ticker: 'ETH',
      address: account.address,
      balance: '0',
      tokens: [],
      // hacky way
      securityKey: JSON.stringify([getUserMasterKey(msc, paymentPassword), getRecoveryMasterKey(msc)]),
      salt: encryptText(msc, salt),
      mnemonic: encryptText(msc, mnemonic)
    }));
  }

  /**
   * Save user's data
   * Note! Use throttler or captcha to prevent spam
   *
   * @param userData user info
   * @return promise
   */
  async create(userData: InputUserData): Promise<CreatedUserData> {
    if (userData.password === userData.paymentPassword) {
      throw new InvalidPassword('Login and payment passwords are matched');
    }

    const initiateVerification = buildScopeEmailVerificationInitiate(
      this.newInitiateVerification(Verifications.USER_SIGNUP, userData.email),
      { email: userData.email, name: userData.name }
    );

    const { email } = userData;
    const existingUser = await getConnection().getMongoRepository(User).findOne({ email });

    if (existingUser) {
      if (!existingUser.isVerified && bcrypt.compareSync(userData.password, existingUser.passwordHash)) {
        return this.initiateCreateAndReturnUser(existingUser, initiateVerification);
      } else {
        throw new UserExists('User already exists');
      }
    }

    this.logger.debug('Create and save a new user', userData.email);

    const user = User.createUser({
      email,
      name: userData.name,
      agreeTos: userData.agreeTos,
      source: userData.source
    });
    user.passwordHash = bcrypt.hashSync(userData.password);

    this.createNewWallet(user, userData.paymentPassword);

    this.logger.debug('Save user', user.email);

    await this.userRepository.save(user);

    return this.initiateCreateAndReturnUser(user, initiateVerification);
  }

  private async addGlobalRegisteredTokens(user: User) {
    this.logger.debug('Fill known global tokens and set verified for', user.email);

    const registeredTokens = await this.tokensRepository.getAllByScope(RegisteredTokenScope.Global);

    user.wallets[0].tokens = registeredTokens.map(rt => Token.createToken({
      contractAddress: rt.contractAddress,
      symbol: rt.symbol,
      name: rt.name,
      decimals: rt.decimals
    }));
  }

  private async activateUserAndGetNewWallets(user: User): Promise<NewWallet[]> {
    this.logger.debug('Save user state', user.email);

    const [userKey, recoveryKey] = JSON.parse(user.wallets[0].securityKey);
    user.wallets[0].securityKey = userKey;
    user.isVerified = true;

    await this.userRepository.save(user);

    this.logger.debug('Save recovery key for', user.email);

    // @TODO: Save in more secure space
    writeFile(join(config.crypto.recoveryFolder, getSha256HexHash(user.email)), recoveryKey);

    this.logger.debug('Prepare response wallets for', user.email);

    const msc = new MasterKeySecret();
    const mnemonic = decryptTextByRecoveryMasterKey(msc, user.wallets[0].mnemonic, recoveryKey);
    const salt = decryptTextByRecoveryMasterKey(msc, user.wallets[0].salt, recoveryKey);

    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt);

    return [{
      ticker: 'ETH',
      address: account.address,
      tokens: [],
      balance: '0',
      mnemonic,
      privateKey: account.privateKey
    }];
  }

  /**
   *
   * @param activationData
   */
  async activate(verify: VerificationInput): Promise<ActivationResult> {
    this.logger.debug('Verify and activate user');

    const { verifyPayload } = await this.verifyAction.verify(Verifications.USER_SIGNUP, verify.verification);

    const user = await getConnection().getMongoRepository(User).findOne({
      email: verifyPayload.userEmail
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }
    if (user.isVerified) {
      throw new UserExists('User already verified');
    }

    this.logger.debug('Register new user in auth service', verifyPayload.userEmail);

    await this.authClient.createUser(transformers.transformUserForAuth(user));

    this.logger.debug('Get auth token for activated user', user.email);

    const loginResult = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    await this.addGlobalRegisteredTokens(user);
    const newWallets = await this.activateUserAndGetNewWallets(user);

    this.logger.debug('Save verified token for activated user', user.email);

    const token = VerifiedToken.createVerifiedToken(user, loginResult.accessToken);
    await getConnection().getMongoRepository(VerifiedToken).save(token);

    this.emailQueue.addJob({
      sender: config.email.from.general,
      recipient: user.email,
      subject: 'You are confirmed your account',
      text: successSignUpTemplate(user.name)
    });

    return {
      accessToken: token.token,
      wallets: newWallets
    };
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

    if (!user || !user.isVerified) {
      throw new UserNotFound('User is not found or not activated!');
    }

    if (!bcrypt.compareSync(loginData.password, user.passwordHash)) {
      throw new InvalidPassword('Incorrect password');
    }

    this.logger.debug('Login in auth service', user.email);

    const tokenData = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    this.logger.debug('Initiate login', user.email);

    const initiateVerification = this.newInitiateVerification(Verifications.USER_SIGNIN, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        { ip, user }
      );
    }

    if (!user.isVerificationEnabled(Verifications.USER_SIGNIN)) {
      initiateVerification.setMethod(VerifyMethod.INLINE);
    }

    const { verifyInitiated } = await this.verifyAction.initiate(initiateVerification, {
      userName: user.name,
      userEmail: user.email,
      accessToken: tokenData.accessToken
    });

    const token = VerifiedToken.createNotVerifiedToken(user, tokenData.accessToken);

    this.logger.debug('Save login user verification token', user.email);

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    return {
      accessToken: tokenData.accessToken,
      isVerified: false,
      verification: verifyInitiated
    };
  }

  /**
   * Verify login
   *
   * @param inputData user info
   * @return promise
   */
  async verifyLogin(verify: VerificationInput): Promise<VerifyLoginResult> {
    this.logger.debug('Verify user login');

    const { verifyPayload } = await this.verifyAction.verify(Verifications.USER_SIGNIN, verify.verification);

    const token = await getConnection().getMongoRepository(VerifiedToken).findOne({
      token: verifyPayload.accessToken
    });

    if (!token) {
      throw new TokenNotFound('Access token is not found for current user');
    }

    this.logger.debug('Save verified login token', verifyPayload.userEmail);

    token.makeVerified();

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    const user = await getConnection().getMongoRepository(User).findOneById(token.userId);
    if (!user) {
      throw new TokenNotFound('Access token is not any match with user');
    }

    if (user.isNotificationEnabled(Notifications.USER_SIGNIN)) {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        subject: 'Successful Login Notification',
        recipient: verifyPayload.userEmail,
        text: successSignInTemplate(verifyPayload.userName, new Date().toUTCString())
      });
    }

    return transformers.transformVerifiedToken(token);
  }

  /**
   *
   * @param user
   * @param scope
   */
  private async initiateGoogleAuthVerification(user: User, scope: Verifications): Promise<InitiatedVerification> {
    this.logger.debug('Initiate attempt to change GoogleAuth', user.email, scope);

    const { verifyInitiated } = await this.verifyAction.initiate(this.newInitiateVerification(scope, user.email), {
      userEmail: user.email
    });

    return verifyInitiated;
  }

  /**
   *
   * @param user
   * @param scope
   * @param verify
   */
  private async verifyAndToggleGoogleAuth(user: User, scope: Verifications, verify: VerificationInput): Promise<any> {
    this.logger.debug('Verify attempt to change GoogleAuth', user.email, user.defaultVerificationMethod);

    const { verifyPayload } = await this.verifyAction.verify(scope, verify.verification, {
      removeSecret: scope === Verifications.USER_DISABLE_GOOGLE_AUTH
    });

    user.defaultVerificationMethod = scope === Verifications.USER_DISABLE_GOOGLE_AUTH ?
      VerifyMethod.EMAIL : VerifyMethod.AUTHENTICATOR;

    this.logger.debug('Save state GoogleAuth', user.email, user.defaultVerificationMethod);

    await this.userRepository.save(user);

    return scope === Verifications.USER_ENABLE_GOOGLE_AUTH;
  }

  /**
   *
   * @param user
   */
  async initiateEnableGoogleAuth(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod === VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('GoogleAuth is enabled already.');
    }

    return {
      verification: await this.initiateGoogleAuthVerification(user, Verifications.USER_ENABLE_GOOGLE_AUTH)
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyEnableGoogleAuth(user: User, verify: VerificationInput): Promise<any> {
    if (user.defaultVerificationMethod === VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('GoogleAuth is enabled already.');
    }

    return {
      enabled: await this.verifyAndToggleGoogleAuth(user, Verifications.USER_ENABLE_GOOGLE_AUTH, verify)
    };
  }

  /**
   *
   * @param user
   */
  async initiateDisableGoogleAuth(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod !== VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('GoogleAuth is disabled already.');
    }

    return {
      verification: await this.initiateGoogleAuthVerification(user, Verifications.USER_DISABLE_GOOGLE_AUTH)
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyDisableGoogleAuth(user: User, verify: VerificationInput): Promise<any> {
    if (user.defaultVerificationMethod !== VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('GoogleAuth is disabled already.');
    }

    return {
      enabled: await this.verifyAndToggleGoogleAuth(user, Verifications.USER_DISABLE_GOOGLE_AUTH, verify)
    };
  }

  /**
   *
   * @param user
   */
  async setNotifications(user: User, notifications: BooleanState): Promise<any> {
    this.logger.debug('Set disabled notifications for', user.email);

    user.preferences = user.preferences || new Preferences();
    user.preferences.setNotifications(notifications);

    this.logger.debug('Save user notifications', user.email, notifications);

    await this.userRepository.save(user);

    return {
      notifications: user.preferences.notifications
    };
  }

  /**
   *
   * @param user
   */
  async initiateSetVerifications(user: User, verifications: BooleanState): Promise<any> {
    this.logger.debug('Initiate change verifications', user.email);

    const initiateVerification = this.newInitiateVerification(Verifications.USER_CHANGE_VERIFICATIONS, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        { user }
      );
    }

    const { verifyInitiated } = await this.verifyAction.initiate(initiateVerification, {
      verifications
    });

    return verifyInitiated;
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifySetVerifications(user: User, verify: VerificationInput): Promise<any> {
    this.logger.debug('Verify change verifications', user.email);

    const { verifyPayload } = await this.verifyAction.verify(Verifications.USER_CHANGE_VERIFICATIONS, verify.verification);

    user.preferences = user.preferences || new Preferences();
    user.preferences.setVerifications(verifyPayload.verifications);

    this.logger.debug('Save user verifications', user.email, verifyPayload.verifications);

    await this.userRepository.save(user);

    return {
      verifications: user.preferences.verifications
    };
  }
}

const UserAccountApplicationType = Symbol('UserAccountApplicationInterface');
export { UserAccountApplicationType };
