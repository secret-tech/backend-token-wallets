import * as request from 'web-request';
import { injectable } from 'inversify';
import * as QR from 'qr-image';

import config from '../../config';
import {
  MaxVerificationsAttemptsReached,
  NotCorrectVerificationCode,
  VerificationIsNotFound
} from '../../exceptions';

/**
 *
 */
export interface VerificationClientInterface {
  initiateVerification(method: string, data: InitiateData): Promise<InitiateResult>;
  validateVerification(method: string, id: string, input: ValidateVerificationInput): Promise<ValidationResult>;
  invalidateVerification(method: string, id: string): Promise<void>;
  getVerification(method: string, id: string): Promise<ValidationResult>;
}

/* istanbul ignore next */
@injectable()
export class VerificationClient implements VerificationClientInterface {
  tenantToken: string;
  baseUrl: string;

  constructor(baseUrl: string = config.verify.baseUrl) {
    request.defaults({
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      throwResponseError: true
    });

    this.baseUrl = baseUrl;
    this.tenantToken = config.auth.token;
  }

  async initiateVerification(method: string, data: InitiateData): Promise<InitiateResult> {
    const result = await request.json<InitiateResult>(`/methods/${method}/actions/initiate`, {
      baseUrl: this.baseUrl,
      auth: {
        bearer: this.tenantToken
      },
      method: 'POST',
      body: data
    });

    result.method = method;
    delete result.code;
    if (result.totpUri) {
      const buffer = QR.imageSync(result.totpUri, {
        type: 'png',
        size: 20
      });
      result.qrPngDataUri = 'data:image/png;base64,' + buffer.toString('base64');
    }

    return result;
  }

  async validateVerification(method: string, id: string, input: ValidateVerificationInput): Promise<ValidationResult> {
    try {
      return await request.json<ValidationResult>(`/methods/${method}/verifiers/${id}/actions/validate`, {
        baseUrl: this.baseUrl,
        auth: {
          bearer: this.tenantToken
        },
        method: 'POST',
        body: input
      });
    } catch (e) {
      if (e.statusCode === 422) {
        if (e.response.body.data.attempts >= config.verify.maxAttempts) {
          await this.invalidateVerification(method, id);
          throw new MaxVerificationsAttemptsReached('You have used all attempts to enter code');
        }

        throw new NotCorrectVerificationCode('Not correct code');
      }

      if (e.statusCode === 404) {
        throw new VerificationIsNotFound('Code was expired or not found. Please retry');
      }

      throw e;
    }
  }

  async invalidateVerification(method: string, id: string): Promise<void> {
    await request.json<Result>(`/methods/${method}/verifiers/${id}`, {
      baseUrl: this.baseUrl,
      auth: {
        bearer: this.tenantToken
      },
      method: 'DELETE'
    });
  }

  async getVerification(method: string, id: string): Promise<ValidationResult> {
    try {
      return await request.json<ValidationResult>(`/methods/${method}/verifiers/${id}`, {
        baseUrl: this.baseUrl,
        auth: {
          bearer: this.tenantToken
        },
        method: 'GET'
      });
    } catch (e) {
      if (e.statusCode === 404) {
        throw new VerificationIsNotFound('Code was expired or not found. Please retry');
      }

      throw e;
    }
  }
}

const VerificationClientType = Symbol('VerificationClientInterface');
export { VerificationClientType };
