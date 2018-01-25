import config from '../../config';

import { VerificationClientInterface } from './verify.client';

interface VerificationInitiateBuilder {
  setExpiredOn(expiredOn: string): VerificationInitiateBuilder;
  setGenerateCode(symbolSet: string[], length: number): VerificationInitiateBuilder;
  setPayload(payload: any): VerificationInitiateBuilder;
  setEmail(fromEmail: string, toEmail: string, subject: string, body: string): VerificationInitiateBuilder;
  setGoogleAuth(consumer: string, issuer: string): VerificationInitiateBuilder;
  getVerificationInitiate(): InitiateData;
}

const DEFAULT_EXPIRED_ON = '01:00:00';

export class VerificationInitiateBuilderImpl implements VerificationInitiateBuilder {
  protected verifyInit: InitiateData;

  constructor() {
    this.verifyInit = {
      consumer: '',
      policy: {
        expiredOn: DEFAULT_EXPIRED_ON
      }
    };
  }

  setExpiredOn(expiredOn: string) {
    this.verifyInit.policy.expiredOn = expiredOn;
    return this;
  }

  setGenerateCode(symbolSet: string[], length: number) {
    this.verifyInit.generateCode = {
      length,
      symbolSet
    };
    return this;
  }

  setPayload(payload: any) {
    this.verifyInit.payload = payload;
    return this;
  }

  setEmail(fromEmail: string, toEmail: string, subject: string, body: string) {
    this.verifyInit.consumer = toEmail;

    this.verifyInit.template = {
      fromEmail,
      subject,
      body
    };
    return this;
  }

  setGoogleAuth(consumer: string, issuer: string) {
    this.verifyInit.consumer = consumer;
    this.verifyInit.issuer = issuer;
    return this;
  }

  getVerificationInitiate(): InitiateData {
    return this.verifyInit;
  }
}

export interface VerificationInitiate {
  setPayload(payload: any): VerificationInitiate;
  runInitiate(verificationClient: VerificationClientInterface): Promise<InitiateResult>;
}

abstract class VerificationInitiateBase implements VerificationInitiate {
  protected verifyBuilder: VerificationInitiateBuilder;
  constructor(expiredOn: string, symbolSet: string[], length: number) {
    this.verifyBuilder = new VerificationInitiateBuilderImpl()
      .setExpiredOn(expiredOn)
      .setGenerateCode(symbolSet, 6);
  }

  setPayload(payload: any) {
    this.verifyBuilder.setPayload(payload);
    return this;
  }

  async runInitiate(verificationClient: VerificationClientInterface): Promise<InitiateResult> {
    return verificationClient.initiateVerification(
      'email', this.verifyBuilder.getVerificationInitiate()
    );
  }
}

export class VerificationInitiateEmail extends VerificationInitiateBase {
  constructor(expiredOn: string = '01:00:00', symbolSet: string[] = ['DIGITS'], length: number = 6) {
    super(expiredOn, symbolSet, length);
  }

  setEmail(toEmail: string, subject: string, body: string, fromEmail?: string) {
    this.verifyBuilder.setEmail(
      fromEmail || config.email.from.general,
      toEmail,
      subject,
      body
    );
    return this;
  }
}

export class VerificationInitiateGoogleAuth extends VerificationInitiateBase {
  constructor(expiredOn: string = '01:00:00', symbolSet: string[] = ['DIGITS'], length: number = 6) {
    super(expiredOn, symbolSet, length);
  }

  setGoogleAuth(consumer: string, issuer: string) {
    this.verifyBuilder.setGoogleAuth(consumer, issuer);
    return this;
  }
}
