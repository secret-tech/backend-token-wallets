import * as Joi from 'joi';
import { Response, Request } from 'express';
import { inject, injectable } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';

import { responseWith } from '../helpers/responses';
import { AuthenticatedRequest } from '../interfaces';

import { UserCommonApplicationType, UserCommonApplication } from '../services/app/user/user.common.app';
import { UserAccountApplicationType, UserAccountApplication } from '../services/app/user/user.account.app';
import { UserPasswordApplicationType, UserPasswordApplication } from '../services/app/user/user.password.app';
import { commonFlowRequestMiddleware, ethereumAddressValidator, verificationValidateSchema } from '../middlewares/request.validation';

const passwordRegex = /^[a-zA-Z0\d!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]{8,}$/;

/**
 * UserController
 */
/* istanbul ignore next */
@controller(
  '/user',
  'ThrottlerMiddleware'
)
export class UserController {
  constructor(
    @inject(UserCommonApplicationType) private userCommonApp: UserCommonApplication,
    @inject(UserAccountApplicationType) private userAccountApp: UserAccountApplication,
    @inject(UserPasswordApplicationType) private userPasswordApp: UserPasswordApplication
  ) { }

  /**
   * Create user
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        name: Joi.string().min(3).required(),
        email: Joi.string().email().required(),
        password: Joi.string().required().regex(passwordRegex),
        paymentPassword: Joi.string().required().regex(passwordRegex), // @TODO: .disallow(Joi.ref('password'))
        agreeTos: Joi.boolean().only(true).required()
      }), req.body, res, next);
    }
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
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        email: Joi.string().email().required(),
        password: Joi.string().required()
      }), req.body, res, next);
    }
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

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/me/erc20token/register',
    'AuthMiddleware',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        walletAddress: ethereumAddressValidator.required(),
        contractAddress: ethereumAddressValidator.required(),
        symbol: Joi.string().required(),
        name: Joi.string().optional(),
        decimals: Joi.number().valid(0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30).required()
      }), req.body, res, next);
    }
  )
  async registerErc20Token(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userCommonApp.registerToken(req.app.locals.user, req.body.walletAddress, req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/me/changePassword/initiate',
    'AuthMiddleware',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        oldPassword: Joi.string().required(),
        newPassword: Joi.string().regex(passwordRegex).disallow(Joi.ref('oldPassword')).required()
      }), req.body, res, next);
    }
  )
  async initiateChangePassword(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.initiateChangePassword(req.app.locals.user, req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/me/changePassword/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async verifyChangePassword(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.verifyChangePassword(req.app.locals.user, req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/resetPassword/initiate',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        email: Joi.string().required().email()
      }), req.body, res, next);
    }
  )
  async initiateResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.initiateResetPassword(req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/resetPassword/verify',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        email: Joi.string().required().email(),
        verification: verificationValidateSchema
      }), req.body, res, next);
    }
  )
  async verifyResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.verifyResetPassword(req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/resetPassword/enter',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        email: Joi.string().email().required(),
        resetId: Joi.string().required(),
        password: Joi.string().required().regex(passwordRegex)
      }), req.body, res, next);
    }
  )
  async enterResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userPasswordApp.resetPasswordEnter(req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpGet(
    '/enable2fa/initiate',
    'AuthMiddleware'
  )
  async enable2faInitiate(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userAccountApp.initiateEnableGoogleAuth(req.app.locals.user));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/enable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async enable2faVerify(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userAccountApp.verifyEnableGoogleAuth(req.app.locals.user, req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpGet(
    '/disable2fa/initiate',
    'AuthMiddleware'
  )
  async disable2faInitiate(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userAccountApp.initiateDisableGoogleAuth(req.app.locals.user));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/disable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async disable2faVerify(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.userAccountApp.verifyDisableGoogleAuth(req.app.locals.user, req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/preferences/notifications',
    'AuthMiddleware',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        notifications: Joi.object().required()
      }), req.body, res, next);
    }
  )
  async setNotification(req: Request & AuthenticatedRequest, res: Response): Promise<void> {
    res.json(await this.userAccountApp.setNotifications(req.app.locals.user, req.body.notifications));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/preferences/verifications/initiate',
    'AuthMiddleware',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        verifications: Joi.object().required()
      }), req.body, res, next);
    }
  )
  async setVerificationInitiate(req: Request & AuthenticatedRequest, res: Response): Promise<void> {
    res.json(await this.userAccountApp.initiateSetVerifications(req.app.locals.user, req.body.verifications));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/preferences/verifications/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async setVerificationVerify(req: Request & AuthenticatedRequest, res: Response): Promise<void> {
    res.json(await this.userAccountApp.verifySetVerifications(req.app.locals.user, req.body));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpPost(
    '/me/wallets',
    'AuthMiddleware',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        type: Joi.string().valid('ETH').required(),
        paymentPassword: Joi.string().required().regex(passwordRegex)
      }), req.body, res, next);
    }
  )
  async createNewWallet(req: Request & AuthenticatedRequest, res: Response): Promise<void> {
    res.json(await this.userAccountApp.createAndAddNewWallet(req.app.locals.user, req.body.type, req.body.paymentPassword));
  }
}
