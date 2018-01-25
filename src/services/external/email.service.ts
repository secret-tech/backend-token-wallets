import { injectable } from 'inversify';
import config from '../../config';
import { Logger } from '../../logger';

export interface EmailServiceInterface {
  send(sender: string, recipient: string, subject: string, text: string): Promise<any>;
}

@injectable()
export class DummyMailService implements EmailServiceInterface {
  private logger: Logger = Logger.getInstance('DUMMYMAIL_SERVICE');

  /**
   * @inheritdoc
   */
  public send(sender: string, recipient: string, subject: string, text: string): Promise<any> {
    this.logger.debug('Send email', sender, recipient, subject, text);

    return Promise.resolve(text);
  }
}

export const EmailServiceType = Symbol('EmailServiceInterface');
