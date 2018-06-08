import { injectable, inject } from 'inversify';
import { BaseMiddleware } from 'inversify-express-utils';
import { Request, Response, NextFunction } from 'express';
import * as expressBearerToken from 'express-bearer-token';
import { getConnection } from 'typeorm';

import { User } from '../entities/user';
import { VerifiedToken } from '../entities/verified.token';
import { AuthenticatedRequest } from '../interfaces';
import { AuthClientType, AuthClientInterface } from '../services/external/auth.client';
import * as i18next from 'i18next';
import * as fs from 'fs';

/* istanbul ignore next */
@injectable()
export class AuthMiddleware extends BaseMiddleware {
  protected expressBearer;
  @inject(AuthClientType) protected authClient: AuthClientInterface;

  /**
   *
   * @param req
   * @param res
   * @param next
   */
  handler(req: AuthenticatedRequest & Request, res: Response, next: NextFunction) {
    const lang = req.get('lang') || 'en';
    const langPath = `../resources/locales/${lang}/errors.json`;
    const translations = fs.existsSync(langPath) ? require(langPath) : null;

    i18next.init({
      lng: lang.toString(),
      resources: translations
    });

    if (!this.expressBearer) {
      this.expressBearer = expressBearerToken();
    }
    this.expressBearer(req, res, async() => {
      try {
        if (!req.headers.authorization || !req['token']) {
          return this.notAuthorized(res);
        }

        req.app.locals.token = req['token'];

        const tokenVerification = await getConnection().getMongoRepository(VerifiedToken).findOne({
          token: req.app.locals.token
        });

        if (!tokenVerification || !tokenVerification.verified) {
          return this.notAuthorized(res);
        }

        const verifyResult = await this.authClient.verifyUserToken(req.app.locals.token);
        req.app.locals.user = await getConnection().getMongoRepository(User).findOne({
          email: verifyResult.login
        });

        if (!req.app.locals.user) {
          return res.status(404).json({
            error: i18next.t('User is not found')
          });
        }

        return next();
      } catch (e) {
        return this.notAuthorized(res);
      }
    });
  }

  notAuthorized(res: Response) {
    return res.status(401).json({
      statusCode: 401,
      error: i18next.t('Not Authorized')
    });
  }
}
