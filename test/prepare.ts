import 'reflect-metadata';
const prepare = require('mocha-prepare');
import { createConnection, getConnection } from 'typeorm';

import * as chai from 'chai';

chai.use(require('chai-http'));
chai.use(require('chai-as-promised'));

import config from '../src/config';
import { container } from '../src/ioc.container';
import { Web3EventType, Web3EventInterface } from '../src/services/events/web3.events';
import { EmailQueueInterface, EmailQueueType } from '../src/services/queues/email.queue';
import { VerifyActionService, VerifyActionServiceType } from '../src/services/external/verify.action.service';

prepare(function (done) {
  // mute standalone services
  container.rebind<Web3EventInterface>(Web3EventType).toConstantValue({} as Web3EventInterface);
  container.rebind<EmailQueueInterface>(EmailQueueType).toConstantValue({
    addJob: function () { }
  } as EmailQueueInterface);

  createConnection({
    type: 'mongodb',
    connectTimeoutMS: 1000,
    url: config.typeOrm.url,
    synchronize: true,
    logging: 'all',
    entities: config.typeOrm.entities,
    migrations: config.typeOrm.migrations,
    subscribers: config.typeOrm.subscribers
  }).then(() => done());
}, function (done) {
  getConnection().close().then(() => done());
});
