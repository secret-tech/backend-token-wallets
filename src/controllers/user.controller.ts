import { Response, Request } from 'express';
import { UserApplicationType, UserApplication } from '../services/app/user.app';
import { inject, injectable } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';

import { AuthenticatedRequest } from '../interfaces';

/**
 * UserController
 */
@controller(
  '/user'
)
export class UserController {
  constructor(
    @inject(UserApplicationType) private userApp: UserApplication
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
    res.json(await this.userApp.create(req.body));
  }

  /**
   * Activate user
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/activate',
    'ActivateUserValidation'
  )
  async activate(req: Request, res: Response): Promise<void> {
    res.json(await this.userApp.activate(req.body));
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
    res.json(await this.userApp.initiateLogin(req.body, req.app.locals.remoteIp));
  }

  /**
   * Verify user login
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/login/verify',
    'VerifyLoginValidation'
  )
  async validateLogin(req: Request, res: Response): Promise<void> {
    res.status(200).send(await this.userApp.verifyLogin(req.body));
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
    res.json(await this.userApp.getUserInfo(req.app.locals.user));
  }

  @httpPost(
    '/me/changePassword/initiate',
    'AuthMiddleware',
    'ChangePasswordValidation'
  )
  async initiateChangePassword(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userApp.initiateChangePassword(req.app.locals.user, req.body));
  }

  @httpPost(
    '/me/changePassword/verify',
    'AuthMiddleware',
    'ChangePasswordValidation'
  )
  async verifyChangePassword(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userApp.verifyChangePassword(req.app.locals.user, req.body));
  }

  @httpPost(
    '/resetPassword/initiate',
    'ResetPasswordInitiateValidation'
  )
  async initiateResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userApp.initiateResetPassword(req.body));
  }

  @httpPost(
    '/resetPassword/verify',
    'ResetPasswordVerifyValidation'
  )
  async verifyResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userApp.verifyResetPassword(req.body));
  }

  @httpGet(
    '/enable2fa/initiate',
    'AuthMiddleware'
  )
  async enable2faInitiate(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userApp.initiateEnable2fa(req.app.locals.user));
  }

  @httpPost(
    '/enable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async enable2faVerify(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userApp.verifyEnable2fa(req.app.locals.user, req.body));
  }

  @httpGet(
    '/disable2fa/initiate',
    'AuthMiddleware'
  )
  async disable2faInitiate(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userApp.initiateDisable2fa(req.app.locals.user));
  }

  @httpPost(
    '/disable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async disable2faVerify(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userApp.verifyDisable2fa(req.app.locals.user, req.body));
  }
}
