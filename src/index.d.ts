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

declare interface InitiatedVerification {
  verificationId: string;
  method: string;
  totpUri?: string;
  qrPngDataUri?: string;
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
  wallets?: any[];
}

declare interface InputUserData extends UserData {
  password: string;
  paymentPassword: string;
}

declare interface Wallet {
  ticker: string;
  address: string;
  balance: string;
  tokens: any[];
  salt?: string;
}

declare interface NewWallet extends Wallet {
  privateKey: string;
  mnemonic: string;
}

declare interface CreatedUserData extends UserData {
  isVerified: boolean;
  defaultVerificationMethod: string;
  verification: InitiatedVerification;
}

declare interface BaseInitiateResult {
  verification: InitiatedVerification;
}

declare interface InitiateLoginResult extends BaseInitiateResult {
  accessToken: string;
  isVerified: boolean;
}

declare interface VerifyLoginResult extends InitiateLoginResult {
}

declare interface VerificationData {
  verificationId: string;
  code: string;
}

declare interface VerificationInput {
  verification: VerificationData;
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

declare interface VerifyLoginInput extends VerificationInput {
  accessToken: string;
}

declare interface ResetPasswordInput {
  email: string;
}

declare interface InitiateChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

declare interface Enable2faResult {
  enabled: boolean;
}

declare interface UserInfo {
  ethAddress: string;
  tokens: any;
  email: string;
  name: string;
  defaultVerificationMethod: string;
}

declare interface TransactionInput {
  from: string;
  to: string;
  amount: string;
  gas: string;
  gasPrice: string;
  data?: any;
}

declare interface DeployContractInput {
  constructorArguments: any;
  byteCode: string;
  gasPrice: string;
  gas?: string;
}

declare interface ExecuteContractConstantMethodInput {
  methodName: string;
  arguments: any;
  gasPrice: string;
}

declare interface ExecuteContractMethodInput extends ExecuteContractConstantMethodInput {
  amount: string;
  gas?: string;
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

declare interface Erc20TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}
