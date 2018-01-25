const prepare = require('mocha-prepare');
import { createConnection } from 'typeorm';

import config from '../src/config';
import { Connection } from 'typeorm/connection/Connection';

let ormConnection: Connection;

prepare(function (done) {
  createConnection({
    type: 'mongodb',
    connectTimeoutMS: 1000,
    url: config.typeOrm.url,
    synchronize: true,
    logging: 'all',
    entities: config.typeOrm.entities,
    migrations: config.typeOrm.migrations,
    subscribers: config.typeOrm.subscribers
  }).then(connection => {
    ormConnection = connection;
    done();
  });
}, function (done) {
  ormConnection.close().then(done);
});
