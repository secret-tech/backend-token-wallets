import * as Bull from 'bull';
import { inject, injectable } from 'inversify';

import config from '../../config';
import { EmailServiceInterface, EmailServiceType } from '../external/email.service';
import { Logger } from '../../logger';

export interface EmailQueueInterface {
  addJob(data: any);
}

/* istanbul ignore next */
/**
 *
 */
@injectable()
export class EmailQueue implements EmailQueueInterface {
  private logger = Logger.getInstance('EMAIL_QUEUE');
  private queueWrapper: any;

  /**
   *
   * @param emailService
   */
  constructor(
    @inject(EmailServiceType) private emailService: EmailServiceInterface
  ) {
    this.initEmailQueue();
  }

  /**
   *
   */
  private initEmailQueue() {
    this.logger.debug('Init email queue');

    this.queueWrapper = new Bull('email_queue', config.redis.url);
    this.queueWrapper.process((job) => {
      return this.process(job);
    });

    this.queueWrapper.on('error', (error) => {
      this.logger.error(error);
    });
  }

  /**
   *
   * @param job
   */
  private async process(job: Bull.Job): Promise<boolean> {
    this.logger.debug('Send email', job.data.sender, job.data.recipient, job.data.subject);

    await this.emailService.send(
      job.data.sender,
      job.data.recipient,
      job.data.subject,
      job.data.text
    );
    return true;
  }

  /**
   *
   * @param data
   */
  addJob(data: any) {
    this.logger.debug('Push email to queue', data.sender, data.recipient, data.subject);

    this.queueWrapper.add(data);
  }
}

const EmailQueueType = Symbol('EmailQueueInterface');
export { EmailQueueType };
