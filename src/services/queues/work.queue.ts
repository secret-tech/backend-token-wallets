import * as Queue from 'bull';
import config from '../../config';
import { Logger } from '../../logger';

/**
 *
 */
export class WorkQueue {
  private logger = Logger.getInstance('WORK_QUEUE');

  /**
   *
   * @param queueName
   */
  constructor(
    private queueName: string
  ) {
  }

  /**
   *
   * @param data
   */
  async publish(data: { id: string, data: any }) {
    this.logger.debug('Publish', this.queueName, data.id);
    const concreatQueue = new Queue(this.queueName, config.redis.url);
    await concreatQueue.add(data);
    concreatQueue.count().then((cnt) => {
      this.logger.debug('Publish queue length', this.queueName, cnt);
      return concreatQueue.close();
    }, (err) => {
      this.logger.error('Error was occurred when publish', this.queueName, data.id, err);
      return concreatQueue.close();
    });
  }

  /**
   *
   * @param callback
   */
  work(callback: (job: any, done: any) => Promise<any>) {
    this.logger.debug('Work for', this.queueName);

    const concreatQueue = new Queue(this.queueName, config.redis.url);

    return concreatQueue.count().then((cnt) => {
      this.logger.debug('Queue length of', this.queueName, cnt);
      concreatQueue.process(async (job, done) => {
        await callback(job, done);
      });
    });
  }
}
