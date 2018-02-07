import config from '../../config';

import { VerificationClientInterface } from './verify.client';
import { VerifyMethod } from './verify.action.service';

/**
 *
 */
export interface Email {
  to: string;
  from?: string;
  subject: string;
  body: string;
}

const DEFAULT_EXPIRED_ON = '01:00:00';

/**
 *
 */
export class VerificationInitiateContext {
  protected verifyInit: InitiateData;
  protected method: string;
  protected scope: string;

  /**
   *
   * @param method
   * @param scope
   */
  constructor(scope: string) {
    this.scope = scope;

    this.verifyInit = {
      consumer: '',
      policy: {
        expiredOn: DEFAULT_EXPIRED_ON
      }
    };
  }

  /**
   *
   * @param method
   */
  setMethod(method: string) {
    this.method = method;
    return this;
  }

  /**
   *
   */
  getMethod(): string {
    return this.method;
  }

  /**
   *
   */
  getScope(): string {
    return this.scope;
  }

  /**
   *
   * @param expiredOn
   */
  setExpiredOn(expiredOn: string) {
    this.verifyInit.policy.expiredOn = expiredOn;
    return this;
  }

  /**
   *
   * @param symbolSet
   * @param length
   */
  setGenerateCode(symbolSet: string[], length: number) {
    this.verifyInit.generateCode = {
      length,
      symbolSet
    };
    return this;
  }

  /**
   *
   * @param payload
   */
  setPayload(payload: any) {
    this.verifyInit.payload = payload;
    return this;
  }

  /**
   *
   * @param email
   */
  setEmail(email: Email) {
    this.verifyInit.consumer = email.to;

    this.verifyInit.template = {
      fromEmail: email.from || config.email.from.general,
      subject: email.subject || 'Empty Subject',
      body: email.body || ''
    };
    return this;
  }

  /**
   *
   * @param consumer
   * @param issuer
   */
  setGoogleAuth(consumer: string, issuer: string) {
    this.verifyInit.consumer = consumer;
    this.verifyInit.issuer = issuer;
    return this;
  }

  /**
   *
   */
  getVerificationInitiate(): InitiateData {
    return this.verifyInit;
  }
}
