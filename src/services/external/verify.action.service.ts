import { inject, injectable } from 'inversify';
import * as uuid from 'node-uuid';
import * as redis from 'redis';
import * as moment from 'moment';
import * as LRU from 'lru-cache';

import config from '../../config';

import { VerificationClientType, VerificationClientInterface } from '../external/verify.client';
import { Logger } from '../../logger';
import { getMongoRepository } from 'typeorm';
import { VerificationInitiateContext } from './verify.context.service';
import { VerificationIsNotFound, MaxVerificationsAttemptsReached, NotCorrectVerificationCode } from '../../exceptions';

export enum VerifyMethod {
  INLINE = 'inline',
  AUTHENTICATOR = 'google_auth',
  EMAIL = 'email'
}

export enum Verifications {
  USER_SIGNUP = 'user_signup',
  USER_SIGNIN = 'user_signin',
  USER_CHANGE_PASSWORD = 'user_change_password',
  USER_RESET_PASSWORD = 'user_reset_password',
  USER_ENABLE_GOOGLE_AUTH = 'user_enable_google_auth',
  USER_DISABLE_GOOGLE_AUTH = 'user_disable_google_auth',

  USER_CHANGE_VERIFICATIONS = 'user_change_verifications',

  TRANSACTION_SEND = 'transaction_send'
}

export function getAllVerifications() {
  return [
    Verifications.USER_SIGNUP,
    Verifications.USER_SIGNIN,
    Verifications.USER_CHANGE_PASSWORD,
    Verifications.USER_RESET_PASSWORD,
    Verifications.USER_ENABLE_GOOGLE_AUTH,
    Verifications.USER_DISABLE_GOOGLE_AUTH,
    Verifications.TRANSACTION_SEND
  ];
}

export function getAllAllowedVerifications() {
  return [
    Verifications.USER_SIGNIN,
    Verifications.USER_CHANGE_PASSWORD,
    Verifications.TRANSACTION_SEND
  ];
}

export class VerifyAction {
  verificationId: string;
  method: string;
  scope: string;
  expiredOn: number;
  payload: string;

  static createVerification(data: any) {
    const verification = new VerifyAction();
    verification.verificationId = data.verificationId;
    verification.expiredOn = data.expiredOn;
    verification.payload = data.payload;
    verification.scope = data.scope;
    verification.method = data.method;
    return verification;
  }
}

/**
 * Verify Action Service
 */
@injectable()
export class VerifyActionService {
  private logger = Logger.getInstance('VERIFY_ACTION');
  private redisClient: redis.RedisClient;
  private verifyPayloads: LRU;

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
    this.verifyPayloads = LRU({
      max: 16384,
      maxAge: 60000
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

    if (context.getMethod() === VerifyMethod.INLINE || config.app.env === 'test') {
      // @TODO: Maybe better only uuid
      const verifyId = uuid.v4() + '-01';
      this.verifyPayloads.set(verifyId, { scope: context.getScope(), payload });
      return {
        verifyInitiated: {
          verificationId: verifyId,
          method: VerifyMethod.INLINE
        },
        verifyInitiatedResult: {
          verificationId: verifyId,
          method: VerifyMethod.INLINE,
          status: 200,
          attempts: 0,
          expiredOn: 0
        }
      };
    }

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
    if (this.verifyPayloads.has(verification.verificationId)) {
      const verifyInline = this.verifyPayloads.get(verification.verificationId);

      if (verifyInline.scope !== scope) {
        throw new VerificationIsNotFound('Invalid scope');
      }

      this.verifyPayloads.del(verification.verificationId);
      return {
        verifyPayload: verifyInline.payload,
        verifyResult: {
          status: 200
        }
      };
    }

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
      if (!(err instanceof NotCorrectVerificationCode)) {
        this.delAction(verification.verificationId).catch(e => this.logger.error);
      }
      throw err;
    }
  }
}

const VerifyActionServiceType = Symbol('VerifyActionService');
export { VerifyActionServiceType };
