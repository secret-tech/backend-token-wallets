import { Request, Response } from 'express';
import { injectable } from 'inversify';
import { controller, httpGet } from 'inversify-express-utils';
import 'reflect-metadata';

import { PrometheusMetrics } from '../services/metrics/prometheus.service';

/**
 * MetricsController currently for prometheus only
 */
@controller(
  '/_metrics',
  'ThrottlerMiddleware',
  'MetricsBasicHttpAuth'
)
export class MetricsController {
  /**
   *
   * @param req
   * @param res
   */
  @httpGet(
    '/prometheus'
  )
  async metricsForPrometheus(req: Request, res: Response): Promise<void> {
    try {
      const instance = PrometheusMetrics.getInstance();
      res.set(instance.getHeaders()).send(instance.getMetrics());
    } catch (error) {
      res.send(error);
    }
  }
}
