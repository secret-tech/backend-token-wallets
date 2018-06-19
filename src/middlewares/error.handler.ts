import { Request, Response, NextFunction } from 'express';

import * as Err from '../exceptions';
import { Logger } from '../logger';
import * as i18next from 'i18next';
import { ErrorWithFields } from '../exceptions';
import * as fs from 'fs';

const logger = Logger.getInstance('ERROR_HANDLER');

export default function defaultExceptionHandle(err: ErrorWithFields, req: Request, res: Response, next: NextFunction): void {
  let status;
  const lang = req.acceptsLanguages() || 'en';
  const langPath = `../resources/locales/${lang}/errors.json`;
  const translations = fs.existsSync(langPath) ? require(langPath) : null;

  i18next.init({
    lng: lang.toString(),
    resources: translations
  });

  switch (err.constructor) {
    case Err.NotCorrectTransactionRequest:
    // no break
    case Err.UserExists:
    // no break
    case Err.NotCorrectVerificationCode:
    // no break
    case Err.MaxVerificationsAttemptsReached:
    // no break
    case Err.IncorrectMnemonic:
    // no break
    case Err.InsufficientEthBalance:
    // no break
    case Err.AuthenticatorError:
      status = 400;
      break;
    case Err.InvalidPassword:
    // no break
    case Err.UserNotActivated:
      status = 403;
      break;
    case Err.VerificationIsNotFound:
    // no break
    case Err.WalletNotFound:
    // no break
    case Err.UserNotFound:
      status = 404;
      break;
    case Err.InvalidTokenDecimals:
      status = 422;
    default:
      status = 500;
  }

  if (status >= 500) {
    logger.error(status, { error: err });
  } else {
    logger.debug(status, { error: err });
  }

  res.status(status).send({
    statusCode: status,
    error: i18next.t(err.message, err.fields)
  });
}
