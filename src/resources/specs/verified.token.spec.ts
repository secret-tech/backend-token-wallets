import * as chai from 'chai';

import { VerifiedToken } from '../../entities/verified.token';
import { User } from '../../entities/user';

const { expect } = chai;

describe('VerifiedToken Entity', () => {
  let verified: VerifiedToken;
  let notVerified: VerifiedToken;

  beforeEach(() => {
    notVerified = VerifiedToken.createNotVerifiedToken({} as User, 'not_verified_token');
    verified = VerifiedToken.createVerifiedToken({} as User, 'verified_token');
  });

  it('should create not verified', () => {
    expect(notVerified.verified).is.false;
  });

  it('should create verified', () => {
    expect(verified.verified).is.true;
  });

  it('should mark as verified', () => {
    notVerified.makeVerified();

    expect(notVerified.verified).is.true;
  });

  it('should throw exception when alredy verified', () => {
    expect(() => verified.makeVerified()).to.throws(Error);
  });
});

