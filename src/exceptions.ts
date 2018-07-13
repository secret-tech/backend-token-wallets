export class ErrorWithFields extends Error {
  fields?: any;
  constructor(message?: string, fields?: any) {
    super(message);
    this.fields = fields;

    Object.setPrototypeOf(this, this.constructor.prototype);
  }
}

export class InvalidPassword extends ErrorWithFields { }
export class UserExists extends ErrorWithFields { }
export class UserNotFound extends ErrorWithFields { }
export class WalletNotFound extends ErrorWithFields { }
export class TokenNotFound extends ErrorWithFields { }
export class InvalidTokenDecimals extends ErrorWithFields { }
export class UserNotActivated extends ErrorWithFields { }
export class AuthenticatorError extends ErrorWithFields { }
export class NotCorrectTransactionRequest extends ErrorWithFields { }
export class NotCorrectVerificationCode extends ErrorWithFields { }
export class VerificationIsNotFound extends ErrorWithFields { }
export class InsufficientEthBalance extends ErrorWithFields { }
export class MaxVerificationsAttemptsReached extends ErrorWithFields { }
export class IncorrectMnemonic extends ErrorWithFields { }
export class NotAuthorized extends ErrorWithFields { }

