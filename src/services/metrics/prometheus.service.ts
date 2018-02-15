import * as prom from 'prom-client';
import metrics from './';

const gaugeSpecificationLabels = {
};

/* istanbul ignore next */
/**
 * Prometheus metrics
 */
export class PrometheusMetrics {
  private counters: { [key: string]: prom.Counter } = {};
  private gauges: { [key: string]: prom.Gauge } = {};

  private constructor() {
    prom.collectDefaultMetrics();

    // auto registration
    Object.keys(metrics).forEach(metricId => {
      const metricName = metrics[metricId];
      if (metricId.slice(0, 2) === 'G_') {
        this.registerGauge(metricName, metricName, gaugeSpecificationLabels[metricId]);
        this.setGauge(metricName, 0, []);
      } else {
        this.registerCounter(metricName, metricName);
      }
    });
  }

  private static _instance: PrometheusMetrics;

  /**
   * Get singleton instance
   */
  static getInstance(): PrometheusMetrics {
    return PrometheusMetrics._instance = PrometheusMetrics._instance || new PrometheusMetrics();
  }

  /**
   * Get headers
   */
  getHeaders(): any {
    return {
      'content-type': prom.register.contentType
    };
  }

  /**
   * Render body for prometheus scrape
   */
  getMetrics(): string {
    return prom.register.metrics();
  }

  /**
   * @param name
   * @param help
   */
  registerCounter(name: string, help: string, labels?: any): prom.Counter {
    return this.counters[name] = new prom.Counter({
      name,
      help,
      labelNames: labels
    });
  }

  /**
   * @param name
   * @param help
   */
  registerGauge(name: string, help: string, labels?: any): prom.Gauge {
    return this.gauges[name] = new prom.Gauge({
      name,
      help,
      labelNames: labels
    });
  }

  /**
   * @param name
   * @param labels
   * @param value
   */
  incCounter(name: string, labels: any, value: number = 1) {
    this.counters[name].inc(labels, value, new Date());
  }

  /**
   * @param name
   * @param value
   * @param labels
   */
  setGauge(name: string, value: number, labels: any) {
    this.gauges[name].set(labels, value, new Date());
  }

  /**
   * @param name
   * @param value
   * @param labels
   */
  incGauge(name: string, value: number, labels: any) {
    this.gauges[name].inc(labels, value, new Date());
  }

  /**
   * @param name
   * @param value
   * @param labels
   */
  decGauge(name: string, value: number, labels: any) {
    this.gauges[name].dec(labels, value, new Date());
  }

  /**
   * @param name
   */
  startGauge(name: string) {
    return this.gauges[name].startTimer();
  }
}
