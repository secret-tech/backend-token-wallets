import * as Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { inject } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';
import { NOT_FOUND } from 'http-status';

import { AuthenticatedRequest } from '../interfaces';
import { responseWith } from '../helpers/responses';

import { DashboardApplicationType, DashboardApplication } from '../services/app/dashboard.app';
import { TransactionApplicationType, TransactionApplication } from '../services/app/transaction.app';
import { commonFlowRequestMiddleware, ethereumAddressValidator } from '../middlewares/request.validation';

/**
 * Dashboard controller
 */
/* istanbul ignore next */
@controller(
  '/dashboard',
  'ThrottlerMiddleware',
  'AuthMiddleware'
)
export class DashboardController {
  constructor(
    @inject(DashboardApplicationType) private dashboardApp: DashboardApplication,
    @inject(TransactionApplicationType) private transactionApp: TransactionApplication
  ) { }

  /**
   * Get main dashboard data
   */
  @httpGet(
    '/',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        walletAddress: ethereumAddressValidator.optional()
      }), req, res, next);
    }
  )
  async dashboard(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.dashboardApp.balancesFor(req.app.locals.user, req.query.walletAddress));
  }

  /**
   *
   * @param req
   * @param res
   */
  @httpGet(
    '/transactionFee',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        gas: Joi.string().required()
      }), req, res, next);
    }
  )
  async getCurrentInvestFee(req: Request, res: Response): Promise<void> {
    res.json(await this.transactionApp.getTransactionFee(req.query.gas));
  }

  /**
   * Get transaction history
   */
  @httpGet(
    '/transactions',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        walletAddress: ethereumAddressValidator.optional(),
        page: Joi.number().optional(),
        limit: Joi.number().optional()
      }), req, res, next);
    }
  )
  async transactionHistory(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await this.transactionApp.transactionHistory(
      req.app.locals.user,
      req.query.walletAddress,
      req.query.page || 0,
      req.query.limit || 50
    ));
  }

  /**
   * Get transaction history
   */
  @httpGet(
    '/erc20TokenInfo',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        contractAddress: ethereumAddressValidator.required()
      }), req, res, next);
    }
  )
  async getErc20TokenInfo(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    const result = await this.dashboardApp.getErc20TokenInfo(req.query.contractAddress);
    if (!result) {
      responseWith(res, {
        message: 'Information is unavailable'
      }, NOT_FOUND);
    } else {
      res.json(result);
    }
  }

  /**
   *
   * @param req
   * @param res
   * @param next
   */
  @httpPost(
    '/transaction/initiate',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        from: ethereumAddressValidator.optional(),
        to: ethereumAddressValidator.required().error(() => 'Invalid recipient address'),
        type: Joi.string().valid('eth_transfer', 'erc20_transfer').required(),
        contractAddress: ethereumAddressValidator.optional(),
        amount: Joi.alternatives([Joi.number().min(1e-6), Joi.string().regex(/(^[\d]+\.?[\d]*$)|(^[\d]*\.?[\d]+$)/)]).required(),
        gas: Joi.string().optional(),
        gasPrice: Joi.string().optional(),
        paymentPassword: Joi.string().required()
      }), req, res, next);
    }
  )
  async transactionInitiate(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json({
      verification: await this.transactionApp.transactionSendInitiate(
        req.app.locals.user, req.body.paymentPassword, {
          from: req.body.from,
          to: req.body.to,
          type: req.body.type,
          contractAddress: req.body.contractAddress,
          amount: req.body.amount,
          gas: req.body.gas || '55000',
          gasPrice: req.body.gasPrice || 0
        })
    });
  }

  /**
   *
   * @param req
   * @param res
   * @param next
   */
  @httpPost(
    '/transaction/verify',
    'VerificationRequiredValidation'
  )
  async transactionVerify(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await this.transactionApp.transactionSendVerify(
      req.body, req.app.locals.user
    ));
  }
}
