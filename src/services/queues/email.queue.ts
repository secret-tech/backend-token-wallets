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
    const logger = this.logger.sub(null, '[initEmailQueue] ');

    logger.debug('[initEmailQueue]');

    this.queueWrapper = new Bull('email_queue', config.redis.url);
    this.queueWrapper.process((job) => {
      return this.process(job);
    });

    this.queueWrapper.on('error', (error) => {
      logger.error(error);
    });
  }

  /**
   *
   * @param job
   */
  private async process(job: Bull.Job): Promise<boolean> {
    this.logger.debug('[process] Send email', {
      meta: {
        sender: job.data.sender,
        recipient: job.data.recipient,
        subject: job.data.subject
      }
    });

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
    this.logger.debug('[addJob] Push email to queue', {
      meta: {
        sender: data.sender,
        recipient: data.recipient,
        subject: data.subject
      }
    });

    this.queueWrapper.add(data);
  }
}

const EmailQueueType = Symbol('EmailQueueInterface');
export { EmailQueueType };
