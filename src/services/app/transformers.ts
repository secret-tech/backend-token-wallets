import config from '../../config';

import { User } from '../../entities/user';
import { VerifiedToken } from '../../entities/verified.token';

export function transformUserForAuth(user: User) {
  return {
    email: user.email,
    login: user.email,
    password: user.passwordHash,
    sub: user.id.toString()
  };
}

export function transformCreatedUser(user: User, verification: InitiatedVerification): CreatedUserData {
  return {
    email: user.email,
    name: user.name,
    agreeTos: user.agreeTos,
    isVerified: user.isVerified,
    defaultVerificationMethod: user.defaultVerificationMethod,
    source: user.source,
    verification: {
      verificationId: verification.verificationId,
      method: verification.method
    }
  };
}

export function transformVerifiedToken(token: VerifiedToken): VerifyLoginResult {
  return {
    accessToken: token.token,
    isVerified: token.verified,
    verification: undefined
  };
}

export function transformWallet(wallet: Wallet): any {
  return {
    ticker: wallet.ticker,
    address: wallet.address,
    tokens: wallet.tokens
  };
}
