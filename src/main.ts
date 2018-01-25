import { createConnection, ConnectionOptions } from 'typeorm';

import config from './config';
import { Logger } from './logger';
import { container } from './ioc.container';
import { HttpServer } from './http.server';

const logger = Logger.getInstance('MAIN');

process.on('unhandledRejection', (reason, p) => {
  logger.error('Stop process. Unhandled Rejection at: Promise ', p, ' reason: ', reason);
  process.exit(1);
});

createConnection(config.typeOrm as ConnectionOptions).then(async connection => {
  logger.info('Run HTTP server');
  const srv = new HttpServer(container);
  srv.serve();
});
