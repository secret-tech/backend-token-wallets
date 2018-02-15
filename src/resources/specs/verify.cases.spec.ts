import * as chai from 'chai';
import { buildScopeEmailVerificationInitiate, buildScopeGoogleAuthVerificationInitiate } from '../../verify.cases';
import { VerificationInitiateContext } from '../../services/external/verify.context.service';
import { Verifications, VerifyMethod } from '../../services/external/verify.action.service';

const { expect } = chai;

describe('Verify Cases', () => {
  function getVerifyInitContext() {
    return [new VerificationInitiateContext(Verifications.USER_SIGNIN), { user: {} }];
  }

  it('should build email verification action', () => {
    const va = buildScopeEmailVerificationInitiate(...getVerifyInitContext());

    expect(va.getScope()).is.equal(Verifications.USER_SIGNIN);
    expect(va.getMethod()).is.equal(VerifyMethod.EMAIL);
  });

  it('should build google auth verification action', () => {
    const va = buildScopeGoogleAuthVerificationInitiate(...getVerifyInitContext());

    expect(va.getScope()).is.equal(Verifications.USER_SIGNIN);
    expect(va.getMethod()).is.equal(VerifyMethod.AUTHENTICATOR);
  });
});
