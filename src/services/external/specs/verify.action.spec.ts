import * as chai from 'chai';
import * as TypeMoq from 'typemoq';
import * as uuid from 'node-uuid';
import { container } from '../../../ioc.container';

import { VerifyActionService, VerifyActionServiceType, VerifyMethod } from '../verify.action.service';
import { VerificationClientInterface, VerificationClient, VerificationClientType } from '../verify.client';
import { VerificationInitiateContext } from '../verify.context.service';
import config from '../../../config';
import { VerificationIsNotFound } from '../../../exceptions';

const { expect } = chai;

describe('VerifyAction Service', () => {
  let verifyAction: VerifyActionService;
  let verifyClientMock: TypeMoq.IMock<VerificationClientInterface>;
  let initiateVerificationMok;
  let validateVerificationMok;
  let verificationId = uuid.v4();
  const code = '000000';

  let c = config;

  beforeEach(() => {
    c.app.env = 'local'; // hacky

    container.snapshot();

    verifyClientMock = TypeMoq.Mock.ofType<VerificationClientInterface>(VerificationClient);

    container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyClientMock.object);
    verifyAction = container.get<VerifyActionService>(VerifyActionServiceType);

    initiateVerificationMok = verifyClientMock
      .setup(x => x.initiateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => ({
        verificationId,
        attempts: 3,
        expiredOn: 1,
        method: VerifyMethod.EMAIL,
        status: 200
      }));
    validateVerificationMok = verifyClientMock
      .setup(x => x.validateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => ({
        status: 200
      }));
  });

  afterEach(() => {
    c.app.env = 'test'; // hacky

    container.get<VerifyActionService>(VerifyActionServiceType)['redisClient'].quit();
    container.restore();
  });

  async function initEmail() {
    initiateVerificationMok.verifiable(TypeMoq.Times.once());

    const verifyInit = await verifyAction.initiate(
      new VerificationInitiateContext('scope').setMethod(VerifyMethod.EMAIL), { payload: 'payload' }
    );

    expect(verifyInit.verifyInitiated).is.not.empty;
    expect(verifyInit.verifyInitiated.method).is.equal(VerifyMethod.EMAIL);
    expect(verifyInit.verifyInitiated.verificationId).is.equal(verificationId);

    return verifyInit;
  }

  it('should verify email', async () => {
    validateVerificationMok.verifiable(TypeMoq.Times.once());

    const verifyInit = await initEmail();
    const result = await verifyAction.verify('scope', {
      verificationId: verifyInit.verifyInitiated.verificationId,
      code
    });
    expect(result.verifyPayload.payload).is.equal('payload');

    verifyClientMock.verifyAll();
  });

  it('should email fail for invalid scope', async () => {
    validateVerificationMok.verifiable(TypeMoq.Times.never());

    const verifyInit = await initEmail();
    expect(verifyAction.verify('invalid_scope', {
      verificationId: verifyInit.verifyInitiated.verificationId,
      code
    })).to.be.rejectedWith(VerificationIsNotFound);

    verifyClientMock.verifyAll();
  });

  it('should email fail for not existsing verificationId', async () => {
    validateVerificationMok.verifiable(TypeMoq.Times.never());

    expect(verifyAction.verify('scope', {
      verificationId: 'not_existing_verification_id',
      code
    })).to.be.rejectedWith(VerificationIsNotFound);

    verifyClientMock.verifyAll();
  });

  async function initInline() {
    initiateVerificationMok.verifiable(TypeMoq.Times.never());

    const verifyInit = await verifyAction.initiate(
      new VerificationInitiateContext('scope').setMethod(VerifyMethod.INLINE), { payload: 'payload' }
    );

    expect(verifyInit.verifyInitiated).is.not.empty;
    expect(verifyInit.verifyInitiated.method).is.equal(VerifyMethod.INLINE);

    return verifyInit;
  }

  it('should verify inline', async () => {
    validateVerificationMok.verifiable(TypeMoq.Times.never());

    const verifyInit = await initInline();
    const result = await verifyAction.verify('scope', {
      verificationId: verifyInit.verifyInitiated.verificationId,
      code
    });

    expect(result.verifyPayload.payload).is.equal('payload');

    verifyClientMock.verifyAll();
  });

  it('should inline fail for not existing verificationId', async () => {
    validateVerificationMok.verifiable(TypeMoq.Times.never());

    expect(verifyAction.verify('scope', {
      verificationId: 'not_existing_verification_id',
      code
    })).to.be.rejectedWith(VerificationIsNotFound);
  });

  it('should inline fail for invalid scope', async () => {
    validateVerificationMok.verifiable(TypeMoq.Times.never());

    const verifyInit = await initInline();

    expect(verifyAction.verify('invalid_scope', {
      verificationId: verifyInit.verifyInitiated.verificationId,
      code
    })).to.be.rejectedWith(VerificationIsNotFound);

    verifyClientMock.verifyAll();
  });
});
