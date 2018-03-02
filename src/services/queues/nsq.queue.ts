import { Writer } from 'nsqjs';
import config from '../../config';
import { Logger } from '../../logger';

/* istanbul ignore next */
/**
 *
 */
export class NsqQueueWriter {
  private logger = Logger.getInstance('NSQ_QUEUE_WRITER');
  protected promiseConnection: Promise<Writer>;

  /**
   *
   * @param topic
   * @param msg
   */
  async publish(topic: string, msg: any): Promise<void> {
    return this.connect().then((writer) => {
      const logger = this.logger.sub({ topic }, '[publish] ');

      logger.debug('Publish message');
      writer.publish(topic, msg, (err) => {
        if (err) {
          logger.error('Publish error', { error: err });
        } else {
          logger.debug('Publish success');
        }
      });
    });
  }

  /**
   *
   */
  private connect(): Promise<Writer> {
    const logger = this.logger.sub(null, '[connect] ');
    return this.promiseConnection = new Promise<Writer>((resolve, reject) => {
      logger.info('Start');
      const writer = new Writer(config.nsqd.host, config.nsqd.port, {
        deflate: true,
        deflateLevel: 6
      });
      writer.connect();
      writer.on('ready', () => {
        logger.info('Ready');
        resolve(writer);
      });
      writer.on('closed', () => {
        logger.info('Closed');
      });
    });
  }
}
