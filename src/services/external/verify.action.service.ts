import { inject, injectable } from 'inversify';
import * as redis from 'redis';
import * as moment from 'moment';

import config from '../../config';

import { VerificationClientType, VerificationClientInterface } from '../external/verify.client';
import { VerifyAction, VerifyMethod } from '../../entities/verify.action';
import { Logger } from '../../logger';
import { getMongoRepository } from 'typeorm';
import { VerificationInitiateContext } from './verify.context.service';
import { VerificationIsNotFound } from '../../exceptions';

/**
 * Verify Action Service
 */
@injectable()
export class VerifyActionService {
  private logger = Logger.getInstance('VERIFY_ACTION');
  private redisClient: redis.RedisClient;

  /**
   * @param verificationClient
   */
  constructor(
    @inject(VerificationClientType) private verificationClient: VerificationClientInterface
  ) {
    this.redisClient = redis.createClient(config.redis.url, {
      prefix: config.redis.prefix + '_va_',
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
  }

  private saveAction(verifyAction: VerifyAction, ttlInSeconds: number) {
    return new Promise((resolve, reject) => {
      this.redisClient.setex(verifyAction.verificationId,
        ttlInSeconds,
        JSON.stringify(verifyAction),
        (err: any, result) => {
          if (err) {
            return reject(new Error(err));
          }
          resolve(verifyAction);
        }
      );
    });
  }

  private getAction(verificationId: string): Promise<VerifyAction> {
    return new Promise((resolve, reject) => {
      this.redisClient.get(verificationId, (err: any, result: string) => {
        if (err) {
          return reject(new Error(err));
        }
        if (!result) {
          return resolve(null);
        }
        try {
          return resolve(VerifyAction.createVerification(JSON.parse(result)));
        } catch (err) {
          return reject(new Error(err));
        }
      });
    });
  }

  private delAction(verificationId: string) {
    return new Promise((resolve, reject) => {
      this.redisClient.del(verificationId, (err: any, n: number) => {
        if (err) {
          return reject(new Error(err));
        }
        if (!n) {
          reject(new Error('VerifyActionId not exists ' + verificationId));
        }
        resolve();
      });
    });
  }

  /**
   *
   * @param context
   * @param payload
   */
  async initiate(context: VerificationInitiateContext, payload?: any):
  Promise<{verifyInitiated: InitiatedVerification, verifyInitiatedResult: InitiateResult}> {

    const initiateVerificationRequest = context.getVerificationInitiate();
    const initiateResult = await this.verificationClient.initiateVerification(
      context.getMethod(), initiateVerificationRequest
    );

    const verifyAction = VerifyAction.createVerification({
      verificationId: initiateResult.verificationId,
      expiredOn: initiateResult.expiredOn,
      scope: context.getScope(),
      method: context.getMethod(),
      payload: JSON.stringify(payload || {})
    });

    await this.saveAction(
      verifyAction,
      Math.max(moment.duration(initiateVerificationRequest.policy.expiredOn).asSeconds(), 60)
    );

    return {
      verifyInitiated: {
        verificationId: initiateResult.verificationId,
        method: initiateResult.method,
        totpUri: initiateResult.totpUri,
        qrPngDataUri: initiateResult.qrPngDataUri
      },
      verifyInitiatedResult: initiateResult
    };
  }

  /**
   *
   * @param scope
   * @param verification
   * @param customArgs
   */
  async verify(scope: string, verification: VerificationData, customArgs?: any):
  Promise<{ verifyPayload: any, verifyResult: ValidationResult }> {
    const verifyAction = await this.getAction(verification.verificationId);

    if (!verifyAction) {
      throw new VerificationIsNotFound('Verify action is not found or expired');
    }

    if (verifyAction.scope !== scope) {
      throw new VerificationIsNotFound('Invalid scope');
    }

    this.logger.debug('Call verify service', scope, verification.verificationId);

    try {
      const verifyResult = await this.verificationClient.validateVerification(verifyAction.method, verifyAction.verificationId, {
        ...customArgs, code: verification.code
      });

      // without await
      this.delAction(verification.verificationId).catch(e => this.logger.error);

      return {
        verifyPayload: JSON.parse(verifyAction.payload),
        verifyResult
      };
    } catch (err) {
      if (err instanceof VerificationIsNotFound) {
        this.delAction(verification.verificationId).catch(e => this.logger.error);
      }
      throw err;
    }
  }
}

const VerifyActionServiceType = Symbol('VerifyActionService');
export { VerifyActionServiceType };
