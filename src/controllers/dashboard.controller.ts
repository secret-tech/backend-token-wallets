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
    '/'
  )
  async dashboard(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.dashboardApp.balancesFor(req.app.locals.user));
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
      }), req.query, res, next);
    }
  )
  async getCurrentInvestFee(req: Request, res: Response): Promise<void> {
    res.json(await this.transactionApp.getTransactionFee(req.query.gas));
  }

  /**
   * Get transaction history
   */
  @httpGet(
    '/transactions'
  )
  async transactionHistory(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await this.transactionApp.transactionHistory(req.app.locals.user));
  }

  /**
   * Get transaction history
   */
  @httpGet(
    '/erc20TokenInfo',
    (req, res, next) => {
      commonFlowRequestMiddleware(Joi.object().keys({
        contractAddress: ethereumAddressValidator.required()
      }), req.query, res, next);
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
        to: ethereumAddressValidator.required(),
        type: Joi.string().valid('eth_transfer', 'erc20_transfer').required(),
        contractAddress: ethereumAddressValidator.optional(),
        amount: Joi.number().required().min(1e-10),
        gas: Joi.string().optional(),
        gasPrice: Joi.string().optional(),
        paymentPassword: Joi.string().required()
      }), req.body, res, next);
    }
  )
  async transactionInitiate(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json({
      verification: await this.transactionApp.transactionSendInitiate(
        req.app.locals.user, req.body.paymentPassword, {
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
