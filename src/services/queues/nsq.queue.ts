import { Writer } from 'nsqjs';
import config from '../../config';
import { Logger } from '../../logger';

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
      this.logger.debug('Publish message to', topic);
      writer.publish(topic, msg, (err) => {
        if (err) {
          this.logger.error('Publish error', topic, err);
        } else {
          this.logger.debug('Publish success', topic);
        }
      });
    });
  }

  /**
   *
   */
  private connect(): Promise<Writer> {
    return this.promiseConnection = new Promise<Writer>((resolve, reject) => {
      this.logger.info('Connect');
      const writer = new Writer(config.nsqd.host, config.nsqd.port, {
        deflate: true,
        deflateLevel: 6
      });
      writer.connect();
      writer.on('ready', () => {
        this.logger.info('Ready');
        resolve(writer);
      });
      writer.on('closed', () => {
        this.logger.info('Closed');
      });
    });
  }
}
