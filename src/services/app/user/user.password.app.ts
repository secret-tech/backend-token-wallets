import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';

import config from '../../../config';

import { AuthClientType, AuthClientInterface } from '../../external/auth.client';
import { EmailQueueType, EmailQueueInterface } from '../../queues/email.queue';

import successPasswordResetTemplate from '../../../resources/emails/8_success_password_reset';
import successPasswordChangeTemplate from '../../../resources/emails/28_success_password_change';
import successPaymentPasswordChangeTemplate from '../../../resources/emails/28_success_pay_password_change';

import {
  UserNotFound,
  InvalidPassword,
  AuthenticatorError
} from '../../../exceptions';
import { User } from '../../../entities/user';
import { VerifiedToken } from '../../../entities/verified.token';
import { Logger } from '../../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../../repositories/user.repository';
import { buildScopeEmailVerificationInitiate, buildScopeGoogleAuthVerificationInitiate } from '../../../verify.cases';
import { VerificationInitiateContext } from '../../external/verify.context.service';
import { VerifyActionServiceType, VerifyActionService, Verifications, VerifyMethod } from '../../external/verify.action.service';
import { UserTimedId } from '../../timed.id';
import { Notifications } from '../../../entities/preferences';
import { MasterKeySecret, decryptTextByUserMasterKey, decryptUserMasterKey, getUserMasterKey } from '../../crypto';

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

    const initiateVerification = this.newInitiateVerification(Verifications.USER_CHANGE_PASSWORD, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        { user }
      );
    }

    if (!user.isVerificationEnabled(Verifications.USER_CHANGE_PASSWORD)) {
      initiateVerification.setMethod(VerifyMethod.INLINE);
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

    const { verifyPayload } = await this.verifyAction.verify(Verifications.USER_CHANGE_PASSWORD, verify.verification);

    this.logger.debug('Save changed password', user.email);

    user.passwordHash = verifyPayload.newPassword;

    await this.userRepository.save(user);

    if (user.isNotificationEnabled(Notifications.USER_CHANGE_PASSWORD)) {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        recipient: user.email,
        subject: 'Password Change Notification',
        text: successPasswordChangeTemplate(user.name)
      });
    }

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
    // it better to use collate in mongo index
    params.email = params.email.toLowerCase();

    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    this.logger.debug('Initiate reset password', user.email);

    const initiateVerification = this.newInitiateVerification(Verifications.USER_RESET_PASSWORD, user.email);
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
  async verifyResetPassword(params: VerificationInput & ResetPasswordInput): Promise<any> {
    // it better to use collate in mongo index
    params.email = params.email.toLowerCase();

    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    this.logger.debug('Verify attempt to reset password', user.email);

    const { verifyPayload } = await this.verifyAction.verify(Verifications.USER_RESET_PASSWORD, params.verification);

    if (user.email !== verifyPayload.userEmail) {
      throw new UserNotFound('User is not found');
    }

    return {
      email: user.email,
      resetId: this.resetPasswordId.generateId(user.id.toString() + user.passwordHash)
    };
  }

  /**
   *
   * @param params
   */
  async resetPasswordEnter(params: { email: string, password: string, resetId: string }) {
    // it better to use collate in mongo index
    params.email = params.email.toLowerCase();

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

    if (user.isNotificationEnabled(Notifications.USER_RESET_PASSWORD)) {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        recipient: user.email,
        subject: 'Password Reset Notification',
        text: successPasswordResetTemplate(user.name)
      });
    }

    return {
      isReset: true
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async initiateChangePaymentPassword(user: User, params: any): Promise<BaseInitiateResult> {
    this.logger.debug('Initiate changing payment password', user.email);

    const msc = new MasterKeySecret();

    if (!decryptTextByUserMasterKey(msc, user.salt, params.oldPaymentPassword, user.securityKey)) {
      throw new InvalidPassword('Invalid payment password');
    }

    this.logger.debug('Prepare new security key', user.email);

    decryptUserMasterKey(msc, user.securityKey, params.oldPaymentPassword);
    const newSecurityKey = getUserMasterKey(msc, params.newPaymentPassword);

    const initiateVerification = this.newInitiateVerification(Verifications.USER_CHANGE_PAYMENT_PASSWORD, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        { user }
      );
    }

    if (!user.isVerificationEnabled(Verifications.USER_CHANGE_PAYMENT_PASSWORD)) {
      initiateVerification.setMethod(VerifyMethod.INLINE);
    }

    this.logger.debug('Initiate verification for changing payment password', user.email);

    const { verifyInitiated } = await this.verifyAction.initiate(initiateVerification, {
      securityKey: newSecurityKey
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
  async verifyChangePaymentPassword(user: User, verify: VerificationInput): Promise<any> {

    this.logger.debug('Verify atempt to change payment password', user.email);

    const { verifyPayload } = await this.verifyAction.verify(Verifications.USER_CHANGE_PAYMENT_PASSWORD, verify.verification);

    this.logger.debug('Save changed payment password', user.email);

    user.securityKey = verifyPayload.securityKey;

    await this.userRepository.save(user);

    if (user.isNotificationEnabled(Notifications.USER_CHANGE_PAYMENT_PASSWORD)) {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        recipient: user.email,
        subject: 'Payment Password Change Notification',
        text: successPaymentPasswordChangeTemplate(user.name)
      });
    }

    return {
      isChanged: true
    };
  }
}

const UserPasswordApplicationType = Symbol('UserPasswordApplicationInterface');
export { UserPasswordApplicationType };
