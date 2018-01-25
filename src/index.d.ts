declare interface RegistrationResult {
  id: string;
  email: string;
  login: string;
}

declare interface TenantRegistrationResult extends RegistrationResult {

}

declare interface UserRegistrationResult extends RegistrationResult {
  tenant: string;
  sub: string;
  scope?: any;
}

declare interface VerificationResult {
  id: string;
  login: string;
  jti: string;
  iat: number;
  aud: string;
}

declare interface TenantVerificationResult extends VerificationResult {
  isTenant: boolean;
}

declare interface UserVerificationResult extends VerificationResult {
  deviceId: string;
  sub: string;
  exp: number;
  scope?: any;
}

declare interface UserVerificationResponse {
  decoded: UserVerificationResult;
}

declare interface TenantVerificationResponse {
  decoded: TenantVerificationResult;
}

declare interface AuthUserData {
  email: string;
  login: string;
  password: string;
  sub: string;
  scope?: any;
}

declare interface UserLoginData {
  login: string;
  password: string;
  deviceId: string;
}

declare interface AccessTokenResponse {
  accessToken: string;
}

declare interface InitiateData {
  consumer: string;
  issuer?: string;
  template?: {
    body: string;
    fromEmail?: string;
    subject?: string;
  };
  generateCode?: {
    length: number;
    symbolSet: Array<string>;
  };
  policy: {
    expiredOn: string;
  };
  payload?: any;
}

declare interface Result {
  status: number;
}

declare interface InitiateResult extends Result {
  verificationId: string;
  attempts: number;
  expiredOn: number;
  method: string;
  code?: string;
  totpUri?: string;
  qrPngDataUri?: string;
}

declare interface ValidationResult extends Result {
  data?: {
    verificationId: string;
    consumer: string;
    expiredOn: number;
    attempts: number;
    payload?: any;
  };
}

declare interface ValidateVerificationInput {
  code: string;
  removeSecret?: boolean;
}

declare interface UserData {
  email: string;
  name: string;
  agreeTos: boolean;
  passwordHash?: string;
  source?: any;
}

declare interface InputUserData extends UserData {
  password: string;
}

declare interface Wallet {
  ticker: string;
  address: string;
  balance: string;
  salt?: string;
}

declare interface NewWallet extends Wallet {
  privateKey: string;
  mnemonic: string;
}

declare interface CreatedUserData extends UserData {
  id: string;
  verification: {
    id: string,
    method: string
  };
  isVerified: boolean;
  defaultVerificationMethod: string;
}

declare interface BaseInitiateResult {
  verification: InitiateResult;
}

declare interface InitiateLoginResult extends BaseInitiateResult {
  accessToken: string;
  isVerified: boolean;
}

declare interface VerifyLoginResult extends InitiateLoginResult {

}

declare interface ActivationUserData {
  email: string;
  verificationId: string;
  code: string;
}

declare interface ActivationResult {
  accessToken: string;
  wallets: Array<NewWallet>;
}

declare interface InitiateLoginInput {
  email: string;
  password: string;
}

declare interface VerifyLoginInput {
  accessToken: string;
  verification: {
    id: string,
    code: string,
    method: string
  };
}

declare interface InitiateChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

declare interface VerificationData {
  verificationId: string;
  code: string;
  method: string;
}

declare interface VerificationInput {
  verification?: VerificationData;
}

declare interface ResetPasswordInput extends VerificationInput {
  email: string;
  password: string;
}

declare interface Enable2faResult {
  enabled: boolean;
}

declare interface UserInfo {
  ethAddress: string;
  email: string;
  name: string;
  defaultVerificationMethod: string;
}

interface TransactionInput {
  from: string;
  to: string;
  amount: string;
  gas: number;
  gasPrice: string;
  data?: any;
}

declare interface DeployContractInput {
  from: string;
  mnemonic: string;
  salt: string;
  constructorArguments: any;
  byteCode: string;
  gasPrice: string;
}

declare interface ExecuteContractConstantMethodInput {
  methodName: string;
  arguments: any;
  gasPrice: string;
}

declare interface ExecuteContractMethodInput extends ExecuteContractConstantMethodInput {
  from: string;
  mnemonic: string;
  salt: string;
  amount: string;
}

declare interface RemoteInfoRequest {
  app: {
    locals: {
      remoteIp: string;
    }
  };
}

declare interface ReqBodyToInvestInput {
  gas: string;
  gasPrice: string;
  ethAmount: string;
}
