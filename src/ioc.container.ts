import { Container, ContainerModule } from 'inversify';
import 'reflect-metadata';
import * as express from 'express';
import { interfaces, TYPE } from 'inversify-express-utils';

import config from './config';

import { AuthMiddleware } from './middlewares/request.auth';
import * as validation from './middlewares/request.validation';

import { UserApplication, UserApplicationType } from './services/app/user.app';
import { AuthClientType, AuthClient, AuthClientInterface } from './services/external/auth.client';
import { VerificationClientType, VerificationClient, VerificationClientInterface } from './services/external/verify.client';
import { Web3ClientInterface, Web3ClientType, Web3Client } from './services/external/web3.client';
import { EmailQueueType, EmailQueueInterface, EmailQueue } from './services/queues/email.queue';
import { Web3EventType, Web3EventInterface, Web3Event } from './services/events/web3.events';
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
import { DummyMailService, EmailServiceInterface, EmailServiceType } from './services/external/email.service';

import { UserController } from './controllers/user.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardApplication, DashboardApplicationType } from './services/app/dashboard.app';

// @TODO: Moveout to file
export function buildApplicationsContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<UserApplication>(UserApplicationType).to(UserApplication);
    bind<DashboardApplication>(DashboardApplicationType).to(DashboardApplication);
  });
}

// @TODO: Moveout to file
export function buildServicesContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<AuthClientInterface>(AuthClientType).to(AuthClient);
    bind<VerificationClientInterface>(VerificationClientType).to(VerificationClient);
    bind<EmailServiceInterface>(EmailServiceType).to(DummyMailService).inSingletonScope();
    bind<EmailQueueInterface>(EmailQueueType).to(EmailQueue).inSingletonScope();
    bind<Web3ClientInterface>(Web3ClientType).to(Web3Client).inSingletonScope();
    bind<Web3EventInterface>(Web3EventType).to(Web3Event).inSingletonScope();

    bind<TransactionRepositoryInterface>(TransactionRepositoryType).to(TransactionRepository).inSingletonScope();
    bind<UserRepositoryInterface>(UserRepositoryType).to(UserRepository).inSingletonScope();
  });
}

// @TODO: Moveout to file
export function buildMiddlewaresContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<AuthMiddleware>('AuthMiddleware').to(AuthMiddleware);
    bind<express.RequestHandler>('CreateUserValidation').toConstantValue(validation.createUser);
    bind<express.RequestHandler>('ActivateUserValidation').toConstantValue(validation.activateUser);
    bind<express.RequestHandler>('InitiateLoginValidation').toConstantValue(validation.initiateLogin);
    bind<express.RequestHandler>('VerifyLoginValidation').toConstantValue(validation.verifyLogin);
    bind<express.RequestHandler>('ChangePasswordValidation').toConstantValue(validation.changePassword);
    bind<express.RequestHandler>('ResetPasswordInitiateValidation').toConstantValue(validation.resetPasswordInitiate);
    bind<express.RequestHandler>('ResetPasswordVerifyValidation').toConstantValue(validation.resetPasswordVerify);
    bind<express.RequestHandler>('VerificationRequiredValidation').toConstantValue(validation.verificationRequired);
    bind<express.RequestHandler>('TransactionFeeValidation').toConstantValue(validation.transactionFee);
    bind<express.RequestHandler>('TransactionSendValidation').toConstantValue(validation.transactionSend);
  });
}

// @TODO: Moveout to file
export function buildControllersContainerModule(): ContainerModule {
  return new ContainerModule((
    bind, unbind, isBound, rebind
  ) => {
    bind<interfaces.Controller>(TYPE.Controller).to(UserController).whenTargetNamed('User');
    bind<interfaces.Controller>(TYPE.Controller).to(DashboardController).whenTargetNamed('Dashboard');
  });
}

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
