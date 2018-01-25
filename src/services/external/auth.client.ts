import * as request from 'web-request';
import { injectable } from 'inversify';

import config from '../../config';
import { Logger } from '../../logger';

export interface AuthClientInterface {
  tenantToken: string;
  registerTenant(email: string, password: string): Promise<TenantRegistrationResult>;
  loginTenant(email: string, password: string): Promise<AccessTokenResponse>;
  verifyTenantToken(token: string): Promise<TenantVerificationResult>;
  logoutTenant(token: string): Promise<void>;
  createUser(data: AuthUserData): Promise<UserRegistrationResult>;
  loginUser(data: UserLoginData): Promise<AccessTokenResponse>;
  verifyUserToken(token: string): Promise<UserVerificationResult>;
  logoutUser(token: string): Promise<void>;
  deleteUser(login: string): Promise<void>;
}

/* istanbul ignore next */
@injectable()
export class AuthClient implements AuthClientInterface {
  private logger: Logger = Logger.getInstance('AUTH_CLIENT_SERVICE');

  tenantToken: string;
  baseUrl: string;

  constructor(baseUrl: string = config.auth.baseUrl) {
    this.tenantToken = config.auth.token;
    this.baseUrl = baseUrl;

    request.defaults({
      throwResponseError: true
    });
  }

  async registerTenant(email: string, password: string): Promise<TenantRegistrationResult> {
    return request.json<TenantRegistrationResult>('/tenant', {
      baseUrl: this.baseUrl,
      method: 'POST',
      body: {
        email,
        password
      }
    });
  }

  async loginTenant(email: string, password: string): Promise<AccessTokenResponse> {
    return request.json<AccessTokenResponse>('/tenant/login', {
      baseUrl: this.baseUrl,
      method: 'POST',
      body: {
        email,
        password
      }
    });
  }

  async verifyTenantToken(token: string): Promise<TenantVerificationResult> {
    return (await request.json<TenantVerificationResponse>('/tenant/verify', {
      baseUrl: this.baseUrl,
      method: 'POST',
      body: {
        token
      }
    })).decoded;
  }

  async logoutTenant(token: string): Promise<void> {
    await request.json<TenantVerificationResult>('/tenant/logout', {
      baseUrl: this.baseUrl,
      method: 'POST',
      body: {
        token
      }
    });
  }

  async createUser(data: AuthUserData): Promise<UserRegistrationResult> {
    return request.json<UserRegistrationResult>('/user', {
      baseUrl: this.baseUrl,
      method: 'POST',
      body: data,
      headers: {
        'authorization': `Bearer ${this.tenantToken}`,
        'accept': 'application/json',
        'content-type': 'application/json'
      }
    });
  }

  async deleteUser(login: string): Promise<void> {
    return request.json<void>(`/user/${login}`, {
      baseUrl: this.baseUrl,
      method: 'DELETE',
      headers: {
        'authorization': `Bearer ${this.tenantToken}`
      }
    });
  }

  async loginUser(data: UserLoginData): Promise<AccessTokenResponse> {
    return request.json<AccessTokenResponse>('/auth', {
      baseUrl: this.baseUrl,
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.tenantToken}`
      },
      body: data
    });
  }

  async verifyUserToken(token: string): Promise<UserVerificationResult> {
    return (await request.json<UserVerificationResponse>('/auth/verify', {
      baseUrl: this.baseUrl,
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.tenantToken}`
      },
      body: { token }
    })).decoded;
  }

  async logoutUser(token: string): Promise<void> {
    await request.json<string>('/auth/logout', {
      baseUrl: this.baseUrl,
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.tenantToken}`
      },
      body: { token }
    });
  }
}

const AuthClientType = Symbol('AuthClientInterface');
export { AuthClientType };
