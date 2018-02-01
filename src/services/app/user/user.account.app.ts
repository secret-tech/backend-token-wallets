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
  TokenNotFound
} from '../../../exceptions';
import { User } from '../../../entities/user';
import { VerifiedToken } from '../../../entities/verified.token';
import * as transformers from '../transformers';
import { generateMnemonic } from '../../crypto';
import { Logger } from '../../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../../repositories/user.repository';
import { RegisteredTokenRepository, RegisteredTokenRepositoryType, RegisteredTokenRepositoryInterface } from '../../repositories/registered.tokens.repository';
import { VerifyScope, buildScopeEmailVerificationInitiate, buildScopeGoogleAuthVerificationInitiate } from '../../../verify.cases';
import { VerificationInitiateContext } from '../../external/verify.context.service';
import { Wallet } from '../../../entities/wallet';
import { VerifyActionServiceType, VerifyActionService } from '../../external/verify.action.service';
import { VerifyMethod } from '../../../entities/verify.action';

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

  /**
   * Save user's data
   * Note! Use throttler or captcha to prevent spam
   *
   * @param userData user info
   * @return promise
   */
  async create(userData: InputUserData): Promise<CreatedUserData> {
    const initiateVerification = buildScopeEmailVerificationInitiate(
      this.newInitiateVerification(VerifyScope.USER_SIGNUP, userData.email),
      { email: userData.email, name: userData.name }
    );

    const { email } = userData;
    const existingUser = await getConnection().getMongoRepository(User).findOne({ email });

    if (existingUser) {
      if (!existingUser.isVerified) {
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

    await this.userRepository.save(user);

    return this.initiateCreateAndReturnUser(user, initiateVerification);
  }

  /**
   *
   * @param activationData
   */
  async activate(verify: VerificationInput): Promise<ActivationResult> {
    this.logger.debug('Verify and activate user');

    const { verifyPayload } = await this.verifyAction.verify(VerifyScope.USER_SIGNUP, verify.verification);

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

    this.logger.debug('Update and create wallets for', user.email);

    const mnemonic = generateMnemonic();
    const salt = bcrypt.genSaltSync();
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt);

    user.isVerified = true;
    user.addWallet(Wallet.createWallet({
      ticker: 'ETH',
      address: account.address,
      balance: '0',
      tokens: [],
      salt
    }));

    await this.userRepository.save(user);

    this.logger.debug('Get auth token for activated user', user.email);

    const loginResult = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    this.logger.debug('Save verified token for activated user', user.email);

    const token = VerifiedToken.createVerifiedToken(user, loginResult.accessToken);

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    this.emailQueue.addJob({
      sender: config.email.from.general,
      recipient: user.email,
      subject: 'You are confirmed your account',
      text: successSignUpTemplate(user.name)
    });

    const resultWallets: Array<NewWallet> = [{
      ticker: 'ETH',
      address: account.address,
      tokens: [],
      balance: '0',
      mnemonic: mnemonic,
      privateKey: account.privateKey
    }];

    return {
      accessToken: token.token,
      wallets: resultWallets
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

    const initiateVerification = this.newInitiateVerification(VerifyScope.USER_SIGNIN, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        { ip, user }
      );
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

    const { verifyPayload } = await this.verifyAction.verify(VerifyScope.USER_SIGNIN, verify.verification);

    const token = await getConnection().getMongoRepository(VerifiedToken).findOne({
      token: verifyPayload.accessToken
    });

    if (!token) {
      throw new TokenNotFound('Access token is not found for current user');
    }

    this.logger.debug('Save verified login token', verifyPayload.userEmail);

    token.makeVerified();

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    this.emailQueue.addJob({
      sender: config.email.from.general,
      subject: 'Successful Login Notification',
      recipient: verifyPayload.userEmail,
      text: successSignInTemplate(verifyPayload.userName, new Date().toUTCString())
    });

    return transformers.transformVerifiedToken(token);
  }
}

const UserAccountApplicationType = Symbol('UserAccountApplicationInterface');
export { UserAccountApplicationType };
