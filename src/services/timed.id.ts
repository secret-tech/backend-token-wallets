import * as bcrypt from 'bcrypt-nodejs';

import { base64encode, base64decode } from '../helpers/helpers';

/**
 *
 */
export class UserTimedId {
  /**
   *
   * @param ns
   * @param ttlInSec
   */
  constructor(private ns: string, private ttlInSec: number = 3600) {
  }

  /**
   *
   */
  private getCurrentTime(): number {
    return ~~(+new Date() / 1000);
  }

  /**
   *
   * @param user
   * @param timer
   */
  private getCurrentRestIdForUser(nonce: string, timer: number) {
    return this.ns + nonce + timer;
  }

  /**
   *
   * @param user
   */
  public generateId(nonce: string): string {
    return base64encode(bcrypt.hashSync(
      this.getCurrentRestIdForUser(nonce, ~~(this.getCurrentTime() / this.ttlInSec))
    ));
  }

  /**
   *
   * @param id
   * @param user
   * @param startTime
   */
  public checkId(id: string, nonce: string): boolean {
    try {
      const decodedHash = base64decode(id);
      return bcrypt.compareSync(
        this.getCurrentRestIdForUser(nonce, ~~((this.getCurrentTime() - 0) / this.ttlInSec)), decodedHash
      ) || bcrypt.compareSync(
        this.getCurrentRestIdForUser(nonce, ~~((this.getCurrentTime() - this.ttlInSec + 1) / this.ttlInSec)), decodedHash
      );
    } catch (err) {
      return false;
    }
  }
}
