import { Request, Response, NextFunction } from 'express';
import { inject } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';

import { AuthenticatedRequest } from '../interfaces';
import { responseWith } from '../helpers/responses';
import { NOT_FOUND } from 'http-status';

import { DashboardApplicationType, DashboardApplication } from '../services/app/dashboard.app';
import { TransactionApplicationType, TransactionApplication } from '../services/app/transaction.app';

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

  @httpGet(
    '/transactionFee',
    'TransactionFeeValidation'
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
    'Erc20TokenInfoValidation'
  )
  async getErc20TokenInfo(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    const result = await this.dashboardApp.getErc20TokenInfo(req.query.contractAddress);
    if (!result) {
      responseWith(res, {
        message: "Information is unavailable"
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
    'TransactionSendValidation'
  )
  async transactionInitiate(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json({
      verification: await this.transactionApp.transactionSendInitiate(
        req.app.locals.user, req.body.mnemonic, {
          to: req.body.to,
          type: req.body.type,
          contractAddress: req.body.contractAddress,
          amount: req.body.amount,
          gasPrice: req.body.gasPrice || 0
        })
    });
  }

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
