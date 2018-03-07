import { injectable } from 'inversify';
import config from '../../config';
import { Logger } from '../../logger';
import { NsqQueueWriter } from '../queues/nsq.queue';

export interface EmailServiceInterface {
  send(sender: string, recipient: string, subject: string, text: string): Promise<any>;
}

/* istanbul ignore next */
@injectable()
export class DummyMailService implements EmailServiceInterface {
  private logger: Logger = Logger.getInstance('DUMMYMAIL_SERVICE');

  /**
   * @inheritdoc
   */
  public send(sender: string, recipient: string, subject: string, text: string): Promise<any> {
    this.logger.debug('[send] Send email', sender, recipient, subject, text);

    return Promise.resolve(text);
  }
}

const NSQ_TOPIC_NOTIFICATION_EMAIL = 'notifications.email.default';

/* istanbul ignore next */
@injectable()
export class NsqChannelMailService implements EmailServiceInterface {
  private logger: Logger = Logger.getInstance('NSQ_CHANNELMAIL_SERVICE');
  private nsq: NsqQueueWriter = new NsqQueueWriter();

  /**
   * @inheritdoc
   */
  public send(sender: string, recipient: string, subject: string, text: string): Promise<any> {
    this.logger.debug('[send] Send email', { meta: { sender, recipient, subject } });

    return this.nsq.publish(NSQ_TOPIC_NOTIFICATION_EMAIL, {
      sender,
      recipient,
      subject,
      body: text
    });
  }
}

export const EmailServiceType = Symbol('EmailServiceInterface');
