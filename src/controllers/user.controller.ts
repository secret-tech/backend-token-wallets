import { Response, Request } from 'express';
import { UserCommonApplicationType, UserCommonApplication } from '../services/app/user/user.common.app';
import { UserAccountApplicationType, UserAccountApplication } from '../services/app/user/user.account.app';
import { UserPasswordApplicationType, UserPasswordApplication } from '../services/app/user/user.password.app';
import { UserSecurityApplicationType, UserSecurityApplication } from '../services/app/user/user.security.app';
import { inject, injectable } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';

import { AuthenticatedRequest } from '../interfaces';

/**
 * UserController
 */
@controller(
  '/user',
  'ThrottlerMiddleware',
)
export class UserController {
  constructor(
    @inject(UserCommonApplicationType) private userCommonApp: UserCommonApplication,
    @inject(UserAccountApplicationType) private userAccountApp: UserAccountApplication,
    @inject(UserPasswordApplicationType) private userPasswordApp: UserPasswordApplication,
    @inject(UserSecurityApplicationType) private userSecurityApp: UserSecurityApplication
  ) { }

  /**
   * Create user
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/',
    'CreateUserValidation'
  )
  async create(req: Request, res: Response): Promise<void> {
    res.json(await this.userAccountApp.create(req.body));
  }

  /**
   * Activate user
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/activate',
    'VerificationRequiredValidation'
  )
  async activate(req: Request, res: Response): Promise<void> {
    res.json(await this.userAccountApp.activate(req.body));
  }

  /**
   * Initiate user login
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/login/initiate',
    'InitiateLoginValidation'
  )
  async initiateLogin(req: RemoteInfoRequest & Request, res: Response): Promise<void> {
    res.json(await this.userAccountApp.initiateLogin(req.body, req.app.locals.remoteIp));
  }

  /**
   * Verify user login
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/login/verify',
    'VerificationRequiredValidation'
  )
  async validateLogin(req: Request, res: Response): Promise<void> {
    res.status(200).send(await this.userAccountApp.verifyLogin(req.body));
  }

  /**
   * Get user info
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpGet(
    '/me',
    'AuthMiddleware'
  )
  async getMe(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userCommonApp.getUserInfo(req.app.locals.user));
  }

  @httpPost(
    '/me/erc20token/register',
    'AuthMiddleware',
    'RegisterErc20TokenValidation'
  )
  async registerErc20Token(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userCommonApp.registerToken(req.app.locals.user, req.body));
  }

  @httpPost(
    '/me/changePassword/initiate',
    'AuthMiddleware',
    'ChangePasswordValidation'
  )
  async initiateChangePassword(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.initiateChangePassword(req.app.locals.user, req.body));
  }

  @httpPost(
    '/me/changePassword/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async verifyChangePassword(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.verifyChangePassword(req.app.locals.user, req.body));
  }

  @httpPost(
    '/resetPassword/initiate',
    'ResetPasswordInitiateValidation'
  )
  async initiateResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.initiateResetPassword(req.body));
  }

  @httpPost(
    '/resetPassword/verify',
    'ResetPasswordVerifyValidation'
  )
  async verifyResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.verifyResetPassword(req.body));
  }

  @httpPost(
    '/resetPassword/enter',
    'ResetPasswordEnterValidation'
  )
  async enterResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.resetPasswordEnter(req.body));
  }

  @httpGet(
    '/enable2fa/initiate',
    'AuthMiddleware'
  )
  async enable2faInitiate(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userSecurityApp.initiateEnable2fa(req.app.locals.user));
  }

  @httpPost(
    '/enable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async enable2faVerify(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userSecurityApp.verifyEnable2fa(req.app.locals.user, req.body));
  }

  @httpGet(
    '/disable2fa/initiate',
    'AuthMiddleware'
  )
  async disable2faInitiate(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userSecurityApp.initiateDisable2fa(req.app.locals.user));
  }

  @httpPost(
    '/disable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async disable2faVerify(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userSecurityApp.verifyDisable2fa(req.app.locals.user, req.body));
  }
}
