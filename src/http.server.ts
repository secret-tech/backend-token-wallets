import * as http from 'http';
import * as bodyParser from 'body-parser';
import 'reflect-metadata';
import { Application } from 'express';
import * as expressWinston from 'express-winston';
import { Container } from 'inversify';
import { InversifyExpressServer } from 'inversify-express-utils';

import config from './config';
import { Logger, newConsoleTransport } from './logger';
import defaultExceptionHandle from './middlewares/error.handler';
import { contentMiddleware, corsMiddleware } from './middlewares/request.common';

/**
 * HttpServer
 */
export class HttpServer {
  protected logger = Logger.getInstance('HTTP_SERVER');
  protected readonly defaultExpressLoggerConfig = {
    transports: [newConsoleTransport()],
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: true,
    ignoreRoute: (req, res) => false
  };
  protected expressApp: Application;

  /**
   * Build http server
   * @param container
   */
  constructor(private container: Container) {
    this.buildExpressApp();
  }

  /**
   *
   */
  protected buildExpressApp(): Application {
    this.logger.verbose('Configure...');

    const inversifyExpress = new InversifyExpressServer(this.container);

    inversifyExpress.setConfig((expressApp) => {
      expressApp.disable('x-powered-by');

      expressApp.use(contentMiddleware);
      expressApp.use(expressWinston.logger(this.defaultExpressLoggerConfig));
      expressApp.use(corsMiddleware);
      expressApp.use(bodyParser.json());
      expressApp.use(bodyParser.urlencoded({ extended: false }));
    });

    inversifyExpress.setErrorConfig((expressApp) => {
      expressApp.use(expressWinston.errorLogger(this.defaultExpressLoggerConfig));

      // 404 handler
      expressApp.use((req, res, next) => {
        res.status(404).send({
          statusCode: 404,
          error: 'Route is not found'
        });
      });

      // exceptions handler
      expressApp.use(defaultExceptionHandle);
    });

    return this.expressApp = inversifyExpress.build();
  }

  protected serveHttp() {
    this.logger.verbose('Create HTTP server...');
    const httpServer = http.createServer(this.expressApp);

    httpServer.listen(config.server.httpPort, config.server.httpIp);
    this.logger.info('Listen HTTP on %s:%s', config.server.httpIp, config.server.httpPort);
  }

  /**
   * Get configurred application
   */
  getExpressApplication(): Application {
    return this.expressApp;
  }

  /**
   * Start listen connections
   */
  serve() {
    this.serveHttp();
  }
}
