import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';

import config from '../../../config';

import {
  AuthenticatorError
} from '../../../exceptions';
import { User } from '../../../entities/user';
import { Logger } from '../../../logger';
import { UserRepositoryType, UserRepositoryInterface } from '../../repositories/user.repository';
import { VerifyScope, buildScopeEmailVerificationInitiate, buildScopeGoogleAuthVerificationInitiate } from '../../../verify.cases';
import { VerificationInitiateContext } from '../../external/verify.context.service';
import { VerifyActionServiceType, VerifyActionService } from '../../external/verify.action.service';
import { VerifyMethod } from '../../../entities/verify.action';

/**
 * UserSecurityApplication
 */
@injectable()
export class UserSecurityApplication {
  private logger = Logger.getInstance('USER_SECURITY_APP');

  /**
   * constructor
   */
  constructor(
    @inject(VerifyActionServiceType) private verifyAction: VerifyActionService,
    @inject(UserRepositoryType) private userRepository: UserRepositoryInterface
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
   * @param scope
   */
  private async initiate2faVerification(user: User, scope: VerifyScope): Promise<InitiatedVerification> {
    this.logger.debug('Initiate attempt to change 2fa', user.email, scope);

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
  private async verifyAndToggle2fa(user: User, scope: VerifyScope, verify: VerificationInput): Promise<any> {
    this.logger.debug('Verify attempt to change 2fa', user.email, user.defaultVerificationMethod);

    const { verifyPayload } = await this.verifyAction.verify(scope, verify.verification, {
      removeSecret: scope === VerifyScope.USER_DISABLE_2FA
    });

    user.defaultVerificationMethod = scope === VerifyScope.USER_DISABLE_2FA ?
      VerifyMethod.EMAIL : VerifyMethod.AUTHENTICATOR;

    this.logger.debug('Save state 2fa', user.email, user.defaultVerificationMethod);

    await this.userRepository.save(user);

    return scope === VerifyScope.USER_ENABLE_2FA;
  }

  /**
   *
   * @param user
   */
  async initiateEnable2fa(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod === VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('Authenticator is enabled already.');
    }

    return {
      verification: await this.initiate2faVerification(user, VerifyScope.USER_ENABLE_2FA)
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyEnable2fa(user: User, verify: VerificationInput): Promise<Enable2faResult> {
    if (user.defaultVerificationMethod === VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('Authenticator is enabled already.');
    }

    return {
      enabled: await this.verifyAndToggle2fa(user, VerifyScope.USER_ENABLE_2FA, verify)
    };
  }

  /**
   *
   * @param user
   */
  async initiateDisable2fa(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod !== VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('Authenticator is disabled already.');
    }

    return {
      verification: await this.initiate2faVerification(user, VerifyScope.USER_DISABLE_2FA)
    };
  }

  /**
   *
   * @param user
   * @param params
   */
  async verifyDisable2fa(user: User, verify: VerificationInput): Promise<Enable2faResult> {
    if (user.defaultVerificationMethod !== VerifyMethod.AUTHENTICATOR) {
      throw new AuthenticatorError('Authenticator is disabled already.');
    }

    return {
      enabled: await this.verifyAndToggle2fa(user, VerifyScope.USER_DISABLE_2FA, verify)
    };
  }
}

const UserSecurityApplicationType = Symbol('UserSecurityApplicationInterface');
export { UserSecurityApplicationType };
