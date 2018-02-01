import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';

import config from '../../../config';

import { AuthClientType, AuthClientInterface } from '../../external/auth.client';
import { EmailQueueType, EmailQueueInterface } from '../../queues/email.queue';

import successPasswordResetTemplate from '../../../resources/emails/8_success_password_reset';
import successPasswordChangeTemplate from '../../../resources/emails/28_success_password_change';

import {
  UserNotFound,
  InvalidPassword,
  AuthenticatorError
} from '../../../exceptions';
import { User } from '../../../entities/user';
import { VerifiedToken } from '../../../entities/verified.token';
import { Logger } from '../../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../../repositories/user.repository';
import { VerifyScope, buildScopeEmailVerificationInitiate, buildScopeGoogleAuthVerificationInitiate } from '../../../verify.cases';
import { VerificationInitiateContext } from '../../external/verify.context.service';
import { VerifyActionServiceType, VerifyActionService } from '../../external/verify.action.service';
import { VerifyMethod } from '../../../entities/verify.action';
import { UserTimedId } from '../../timed.id';

/**
 * UserPasswordApplication
 */
@injectable()
export class UserPasswordApplication {
  private logger = Logger.getInstance('USER_PASSWORD_APP');
  private resetPasswordId = new UserTimedId('resetPassword', 3600);

  /**
   * constructor
   */
  constructor(
    @inject(VerifyActionServiceType) private verifyAction: VerifyActionService,
    @inject(AuthClientType) private authClient: AuthClientInterface,
    @inject(UserRepositoryType) private userRepository: UserRepositoryInterface,
    @inject(EmailQueueType) private emailQueue: EmailQueueInterface
  ) { }

  // @TODO: DRY
  private newInitiateVerification(scope: string, consumer: string) {
    return buildScopeGoogleAuthVerificationInitiate(
      new VerificationInitiateContext(scope), { consumer }
    );
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

    const initiateVerification = this.newInitiateVerification(VerifyScope.USER_CHANGE_PASSWORD, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        { user }
      );
    }

    const { verifyInitiated } = await this.verifyAction.initiate(initiateVerification, {
      newPassword: bcrypt.hashSync(params.newPassword)
    });

    return {
      verification: verifyInitiated
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyChangePassword(user: User, verify: VerificationInput): Promise<AccessTokenResponse> {

    this.logger.debug('Verify atempt to change password', user.email);

    const { verifyPayload } = await this.verifyAction.verify(VerifyScope.USER_CHANGE_PASSWORD, verify.verification);

    this.logger.debug('Save changed password', user.email);

    user.passwordHash = verifyPayload.newPassword;

    await this.userRepository.save(user);

    this.emailQueue.addJob({
      sender: config.email.from.general,
      recipient: user.email,
      subject: 'Password Change Notification',
      text: successPasswordChangeTemplate(user.name)
    });

    this.logger.debug('Recreate user with changed password in auth', user.email);

    await this.authClient.createUser({
      email: user.email,
      login: user.email,
      password: user.passwordHash,
      sub: user.id.toString()
    });

    this.logger.debug('Reauth user to get auth token after changing password', user.email);

    const loginResult = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    const token = VerifiedToken.createVerifiedToken(user, loginResult.accessToken);

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

    const initiateVerification = this.newInitiateVerification(VerifyScope.USER_RESET_PASSWORD, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        { user }
      );
    }

    const { verifyInitiated } = await this.verifyAction.initiate(initiateVerification, {
      userEmail: user.email
    });

    return {
      verification: verifyInitiated
    };
  }

  /**
   *
   * @param params
   */
  async verifyResetPassword(params: ResetPasswordInput): Promise<any> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    this.logger.debug('Verify attempt to reset password', user.email);

    const { verifyPayload } = await this.verifyAction.verify(VerifyScope.USER_RESET_PASSWORD, params.verification);

    if (user.email !== verifyPayload.userEmail) {
      throw new UserNotFound('User is not found');
    }

    return {
      email: user.email,
      resetId: this.resetPasswordId.generateId(user.id.toString() + user.passwordHash),
    };
  }

  /**
   *
   * @param params
   */
  async resetPasswordEnter(params: { email: string, password: string, resetId: string }) {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    if (!this.resetPasswordId.checkId(params.resetId, user.id.toString() + user.passwordHash)) {
      throw new UserNotFound('User is not found');
    }

    this.logger.debug('Save user with new reset password', user.email);

    user.passwordHash = bcrypt.hashSync(params.password);
    await this.userRepository.save(user);

    this.logger.debug('Reauth user to get new auth token after reset password', user.email);

    await this.authClient.createUser({
      email: user.email,
      login: user.email,
      password: user.passwordHash,
      sub: user.id.toString()
    });

    this.emailQueue.addJob({
      sender: config.email.from.general,
      recipient: user.email,
      subject: 'Password Reset Notification',
      text: successPasswordResetTemplate(user.name)
    });

    return {
      isReset: true
    }
  }
}

const UserPasswordApplicationType = Symbol('UserPasswordApplicationInterface');
export { UserPasswordApplicationType };
