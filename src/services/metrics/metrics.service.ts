import { PrometheusMetrics } from './prometheus.service';

interface Tags {
  [key: string]: string;
}

/* istanbul ignore next */
/**
 * Proxy service
 * @TODO: Think about: may it'll specialized methods be better than common with consts:
 *   this.metricsService.incCounter(metrics.C_INVOKE, { ...metricsCommonTags,
 *     'status': '500'
 *   });
 * alternative:
 *   this.metricsService.chaincodeInvoke('500', metricsCommonTags);
 */
export class MetricsService {
  private svc: PrometheusMetrics = PrometheusMetrics.getInstance();

  /**
   * @param name
   * @param tags
   * @param value
   */
  incCounter(name, tags?: Tags, value: number = 1) {
    this.svc.incCounter(name, tags, value);
  }

  /**
   * @param name
   * @param value
   * @param tags
   */
  incGauge(name, value: number, tags: Tags) {
    this.svc.incGauge(name, value, tags);
  }

  /**
   * @param name
   * @param value
   * @param tags
   */
  decGauge(name, value: number, tags: Tags) {
    this.svc.incGauge(name, value, tags);
  }

  /**
   * @param name
   * @param value
   * @param tags
   */
  setGauge(name, value: number, tags: Tags) {
    this.svc.setGauge(name, value, tags);
  }

  /**
   * @param name
   */
  startGauge(name: string): (tags?: Tags) => void {
    return this.svc.startGauge(name);
  }
}
