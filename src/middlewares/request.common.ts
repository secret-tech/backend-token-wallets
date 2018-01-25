import { Response, Request, NextFunction } from 'express';
import { NOT_ACCEPTABLE } from 'http-status';

import config from '../config';

export function getRemoteIpFromRequest(req: Request): string {
  let remoteIp = req.header('cf-connecting-ip') || req.ip;
  if (remoteIp.substr(0, 7) === '::ffff:') {
    remoteIp = remoteIp.substr(7);
  }

  return remoteIp;
}

export function httpsMiddleware(req: RemoteInfoRequest & Request, res: Response, next: NextFunction) {
  // @TODO: Use hemlet package from npm
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }

  next();
}

export function contentMiddleware(req: RemoteInfoRequest & Request, res: Response, next: NextFunction) {
  if (req.method !== 'OPTIONS') {
    const acceptHeader = req.header('Accept') || '';
    if (acceptHeader !== 'application/json' && !acceptHeader.includes('application/vnd.wallets+json;')) {
      return res.status(NOT_ACCEPTABLE).json({
        error: 'Unsupported "Accept" header'
      });
    }
    const contentHeader = req.header('Content-Type') || '';
    if (contentHeader !== 'application/json' && !contentHeader.includes('application/x-www-form-urlencoded')) {
      return res.status(NOT_ACCEPTABLE).json({
        error: 'Unsupported "Content-Type"'
      });
    }
  }

  // @TODO: Use hemlet package from npm
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'deny');
  res.setHeader('Content-Security-Policy', 'default-src \'none\'');

  req.app.locals.remoteIp = getRemoteIpFromRequest(req);

  return next();
}

// @TODO: Use express-cors package from npm
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Origin, X-Requested-With, Content-Type, Accept');

  return next();
}
