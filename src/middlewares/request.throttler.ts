import { injectable } from 'inversify';
import { Response, Request, NextFunction } from 'express';
import * as redis from 'redis';
import RateLimiter = require('rolling-rate-limiter');
import config from '../config';
import { getRemoteIpFromRequest } from './request.common';
import { BaseMiddleware } from 'inversify-express-utils';

const { throttler: { prefix, interval, maxInInterval, minDifference, whiteList } } = config;

const defaultOptions = {
  namespace: prefix,
  interval: interval,
  maxInInterval: maxInInterval,
  minDifference: minDifference,
  whiteList: whiteList
};

/**
 * Throttler middleware. Should be singleton (for single redis connection).
 */
@injectable()
export class ThrottlerMiddleware extends BaseMiddleware {
  private limiter: RateLimiter;
  private whiteList: Array<string>;

  /**
   * constructor
   */
  constructor() {
    super();

    const { redis: { url } } = config;
    const redisClient = redis.createClient(url, {
      prefix: config.redis.prefix + '_thm_',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    this.limiter = RateLimiter({
      redis: redisClient,
      ...defaultOptions
    });
    this.whiteList = defaultOptions.whiteList;
  }

  /**
   * Default handler method.
   * @param req
   * @param res
   * @param next
   */
  handler(req: Request, res: Response, next: NextFunction) {
    const ip = getRemoteIpFromRequest(req);

    if (this.whiteList.indexOf(ip) !== -1) {
      return next();
    }

    this.limiter(ip, (err, timeLeft) => {
      if (err) {
        return res.status(500).send();
      } else if (timeLeft) {
        return res.status(429).send('You must wait ' + timeLeft + ' ms before you can make requests.');
      } else {
        return next();
      }
    });
  }
}
