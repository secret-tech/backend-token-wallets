import * as chai from 'chai';

import { UserTimedId } from '../timed.id';
import { readFileSync } from 'fs';
import { base64encode } from '../../helpers/helpers';

const { expect } = chai;

describe('UserTimedId', () => {
  let uid: UserTimedId;

  beforeEach(() => {
    uid = new UserTimedId('namespace', 60);
  })

  it('should success for right id', () => {
    expect(uid.checkId(uid.generateId('0'), '0')).is.true;
  });

  it('should fail for wrong id', () => {
    expect(uid.checkId(base64encode('012234'), '0')).is.false;
  });

  it('should fail for differ nonce', () => {
    expect(uid.checkId(uid.generateId('0'), '1')).is.false;
  });
});
