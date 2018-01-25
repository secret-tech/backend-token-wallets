import { Request, Response, NextFunction } from 'express';
import { inject } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';

import { AuthenticatedRequest } from '../interfaces';
import { DashboardApplicationType, DashboardApplication } from '../services/app/dashboard.app';

/**
 * Dashboard controller
 */
@controller(
  '/dashboard'
)
export class DashboardController {
  constructor(
    @inject(DashboardApplicationType) private dashboardApp: DashboardApplication
  ) { }

  /**
   * Get main dashboard data
   */
  @httpGet(
    '/',
    'AuthMiddleware'
  )
  async dashboard(req: AuthenticatedRequest & Request, res: Response): Promise<void> {
    res.json(await this.dashboardApp.balancesFor(req.app.locals.user.wallet.address));
  }

  @httpPost(
    '/transactionFee',
    'TransactionFeeValidation'
  )
  async getCurrentInvestFee(req: Request, res: Response): Promise<void> {
    res.json(await this.dashboardApp.getTransactionFee(req.body.gas));
  }

  /**
   * Get transaction history
   */
  @httpGet(
    '/transactions',
    'AuthMiddleware'
  )
  async transactionHistory(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await this.dashboardApp.transactionHistory(req.app.locals.user));
  }

  @httpPost(
    '/transaction/initiate',
    'AuthMiddleware',
    'TransactionSendValidation'
  )
  async transactionInitiate(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json({
      verification: await this.dashboardApp.transactionSendInitiate(
        req.app.locals.user, req.body.mnemonic, {
          to: req.body.to,
          type: req.body.type,
          amount: req.body.amount,
          gasPrice: req.body.gasPrice || 0
        })
    });
  }

  @httpPost(
    '/transaction/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async transactionVerify(req: AuthenticatedRequest & Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await this.dashboardApp.transactionSendVerify(
      req.body.verification, req.app.locals.user, req.body.mnemonic
    ));
  }
}
