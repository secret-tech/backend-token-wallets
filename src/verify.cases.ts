import config from './config';
import { VerificationInitiateContext } from './services/external/verify.context.service';

import initiateSignUpTemplate from './resources/emails/1_initiate_signup';
import initiateSignInCodeTemplate from './resources/emails/3_initiate_signin_code';
import initiatePasswordResetTemplate from './resources/emails/6_initiate_password_reset_code';
import initiatePasswordChangeTemplate from './resources/emails/27_initiate_password_change_code';
import initiateTransactionTemplate from './resources/emails/12_initiate_transaction_code';

import { User } from './entities/user';
import { VerifyMethod } from './entities/verify.action';

const defaultInit = {
  issuer: 'Jincor',
  length: 6,
  symbolSet: [
    'DIGITS'
  ]
};

export enum VerifyScope {
  USER_SIGNUP = 'activate_user',
  USER_SIGNIN = 'login_user',
  USER_CHANGE_PASSWORD = 'change_password',
  USER_RESET_PASSWORD = 'reset_password',
  USER_ENABLE_2FA = 'enable_2fa',
  USER_DISABLE_2FA = 'disable_2fa',

  TRANSACTION_SEND = 'transaction_send'
}

/**
 *
 * @param verify
 * @param context
 */
function buildVerificationInitiate(verify: VerificationInitiateContext, context: any): VerificationInitiateContext {
  verify.setGenerateCode(defaultInit.symbolSet, defaultInit.length);

  switch (verify.getScope()) {

    case VerifyScope.USER_SIGNIN:
    // no break

    case VerifyScope.USER_RESET_PASSWORD:
    // no break

    case VerifyScope.USER_ENABLE_2FA:
    // no break

    case VerifyScope.USER_DISABLE_2FA:
    // no break

    case VerifyScope.TRANSACTION_SEND:

      return verify.setExpiredOn('01:00:00');

    default:

      return verify.setExpiredOn('24:00:00');

  }
}

/**
 *
 * @param verify
 * @param context
 */
export function buildScopeEmailVerificationInitiate(verify: VerificationInitiateContext, context: any): VerificationInitiateContext {
  verify.setMethod(VerifyMethod.EMAIL);
  buildVerificationInitiate(verify, context);

  switch (verify.getScope()) {

    case VerifyScope.USER_SIGNUP:
      const encodedEmail = encodeURIComponent(context.to);
      const link = `${config.app.frontendPrefixUrl}/auth/signup?type=activate&code={{{CODE}}}&verificationId={{{VERIFICATION_ID}}}&email=${encodedEmail}`;

      return verify.setEmail({
        to: context.email,
        subject: 'Verify your email',
        body: initiateSignUpTemplate(context.name, link)
      });

    case VerifyScope.USER_SIGNIN:

      return verify.setEmail({
        to: context.user.email,
        subject: 'Login Verification Code',
        body: initiateSignInCodeTemplate(context.user.name, new Date().toUTCString(), context.ip)
      });

    case VerifyScope.USER_CHANGE_PASSWORD:

      return verify.setEmail({
        to: context.user.email,
        subject: 'Here’s the Code to Change Your Password',
        body: initiatePasswordChangeTemplate(context.user.name)
      });

    case VerifyScope.USER_RESET_PASSWORD:

      return verify.setEmail({
        to: context.user.email,
        subject: 'Here’s the Code to Reset Your Password',
        body: initiatePasswordResetTemplate(context.user.name)
      });

    case VerifyScope.TRANSACTION_SEND:

      return verify.setEmail({
        to: context.user.email,
        subject: 'You Transaction Validation Code to Use',
        body: initiateTransactionTemplate(context.user.name, context.transactionType)
      });

    case VerifyScope.USER_ENABLE_2FA:
    // no break

    case VerifyScope.USER_DISABLE_2FA:
    // no break

    default:

      return verify;
  }
}

/**
 *
 * @param verify
 * @param context
 */
export function buildScopeGoogleAuthVerificationInitiate(verify: VerificationInitiateContext, context: any): VerificationInitiateContext {
  verify.setMethod(VerifyMethod.AUTHENTICATOR);

  return buildVerificationInitiate(verify, context)
    .setGenerateCode(defaultInit.symbolSet, defaultInit.length)
    .setGoogleAuth(context.consumer, 'Jincor');
}
