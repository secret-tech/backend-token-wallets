import { Container, ContainerModule } from 'inversify';
import 'reflect-metadata';
import * as express from 'express';
import { interfaces, TYPE } from 'inversify-express-utils';
import * as basicAuth from 'express-basic-auth';

import config from './config';

import { AuthMiddleware } from './middlewares/request.auth';
import { ThrottlerMiddleware } from './middlewares/request.throttler';
import * as validation from './middlewares/request.validation';

import { AuthClientType, AuthClient, AuthClientInterface } from './services/external/auth.client';
import { VerificationClientType, VerificationClient, VerificationClientInterface } from './services/external/verify.client';
import { Web3ClientInterface, Web3ClientType, Web3Client } from './services/external/web3.client';
import { EmailQueueType, EmailQueueInterface, EmailQueue } from './services/queues/email.queue';
import { Web3EventType, Web3EventInterface, Web3Event } from './services/events/web3.events';
import {
  RegisteredTokenRepository,
  RegisteredTokenRepositoryInterface,
  RegisteredTokenRepositoryType
} from './services/repositories/registered.tokens.repository';
import {
  TransactionRepository,
  TransactionRepositoryInterface,
  TransactionRepositoryType
} from './services/repositories/transaction.repository';
import {
  UserRepository,
  UserRepositoryInterface,
  UserRepositoryType
} from './services/repositories/user.repository';
import { DummyMailService, EmailServiceInterface, EmailServiceType, NsqChannelMailService } from './services/external/email.service';
import { VerifyActionService, VerifyActionServiceType } from './services/external/verify.action.service';

import { MetricsController } from './controllers/metrics.controller';
import { UserController } from './controllers/user.controller';
import { DashboardController } from './controllers/dashboard.controller';

import { UserCommonApplication, UserCommonApplicationType } from './services/app/user/user.common.app';
import { UserAccountApplication, UserAccountApplicationType } from './services/app/user/user.account.app';
import { UserPasswordApplication, UserPasswordApplicationType } from './services/app/user/user.password.app';
import { TransactionApplication, TransactionApplicationType } from './services/app/transaction.app';
import { DashboardApplication, DashboardApplicationType } from './services/app/dashboard.app';

// @TODO: Moveout to file
/* istanbul ignore next */
export function buildApplicationsContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<UserCommonApplication>(UserCommonApplicationType).to(UserCommonApplication);
    bind<UserAccountApplication>(UserAccountApplicationType).to(UserAccountApplication);
    bind<UserPasswordApplication>(UserPasswordApplicationType).to(UserPasswordApplication);
    bind<DashboardApplication>(DashboardApplicationType).to(DashboardApplication);
    bind<TransactionApplication>(TransactionApplicationType).to(TransactionApplication);
  });
}

// @TODO: Moveout to file
/* istanbul ignore next */
export function buildServicesContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<AuthClientInterface>(AuthClientType).to(AuthClient);
    bind<VerificationClientInterface>(VerificationClientType).to(VerificationClient);
    bind<VerifyActionService>(VerifyActionServiceType).to(VerifyActionService).inSingletonScope();
    if (config.app.env === 'test') {
      bind<EmailServiceInterface>(EmailServiceType).to(DummyMailService).inSingletonScope();
    } else {
      bind<EmailServiceInterface>(EmailServiceType).to(NsqChannelMailService).inSingletonScope();
    }
    bind<EmailQueueInterface>(EmailQueueType).to(EmailQueue).inSingletonScope();
    bind<Web3ClientInterface>(Web3ClientType).to(Web3Client).inSingletonScope();
    bind<Web3EventInterface>(Web3EventType).to(Web3Event).inSingletonScope();

    bind<RegisteredTokenRepositoryInterface>(RegisteredTokenRepositoryType).to(RegisteredTokenRepository).inSingletonScope();
    bind<TransactionRepositoryInterface>(TransactionRepositoryType).to(TransactionRepository).inSingletonScope();
    bind<UserRepositoryInterface>(UserRepositoryType).to(UserRepository).inSingletonScope();
  });
}

// @TODO: Moveout to file
/* istanbul ignore next */
export function buildMiddlewaresContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<AuthMiddleware>('AuthMiddleware').to(AuthMiddleware).inSingletonScope();
    bind<ThrottlerMiddleware>('ThrottlerMiddleware').to(ThrottlerMiddleware).inSingletonScope();
    bind<express.RequestHandler>('MetricsBasicHttpAuth').toConstantValue(
      (req: any, res: any, next: any) => basicAuth({
        users: { [config.metrics.authUsername]: config.metrics.authPassword },
        unauthorizedResponse: 'Unauthorized',
        challenge: true
      })(req, res, next)
    );
    bind<express.RequestHandler>('VerificationRequiredValidation').toConstantValue(validation.verificationRequired);
  });
}

// @TODO: Moveout to file
/* istanbul ignore next */
export function buildControllersContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<interfaces.Controller>(TYPE.Controller).to(MetricsController).whenTargetNamed('Metrics');
    bind<interfaces.Controller>(TYPE.Controller).to(UserController).whenTargetNamed('User');
    bind<interfaces.Controller>(TYPE.Controller).to(DashboardController).whenTargetNamed('Dashboard');
  });
}

/* istanbul ignore next */
export function buildIoc(): Container {
  const container = new Container();
  container.load(
    buildMiddlewaresContainerModule(),
    buildServicesContainerModule(),
    buildApplicationsContainerModule(),
    buildControllersContainerModule()
  );
  return container;
}

export const container = buildIoc();
