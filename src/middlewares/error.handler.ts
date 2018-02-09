import { Request, Response, NextFunction } from 'express';

import * as Err from '../exceptions';
import { Logger } from '../logger';

const logger = Logger.getInstance('ERROR_HANDLER');

export default function defaultExceptionHandle(err: Error, req: Request, res: Response, next: NextFunction): void {
  let status;

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
    case Err.UserNotFound:
      status = 404;
      break;
    case Err.InvalidTokenDecimals:
      status = 422;
    default:
      status = 500;
  }

  if (status >= 500) {
    logger.error(status, err.message, err.stack);
  } else {
    logger.debug(status, err.message, err.stack);
  }

  res.status(status).send({
    statusCode: status,
    error: err.message
  });
}
