import * as chai from 'chai';

import { Preferences, Notifications } from '../../entities/preferences';
import { Verifications } from '../../services/external/verify.action.service';

const { expect } = chai;

describe('Preferences Entity', () => {
  let p: Preferences;

  beforeEach(() => {
    p = new Preferences();
    p.setNotifications({});
    p.setVerifications({});
  });

  it('should set notifications all true if empty arg passed', () => {
    expect(Object.keys(p.notifications).some(k => p.notifications[k])).is.true;
  });

  it('should set verifications all true if empty arg passed', () => {
    expect(Object.keys(p.verifications).some(k => p.verifications[k])).is.true;
  });

  it('should disable notifications if false passed', () => {
    p.setNotifications({
      [Notifications.USER_SIGNIN]: false,
      [Notifications.USER_CHANGE_PASSWORD]: false
    });

    expect(p.notifications[Notifications.USER_RESET_PASSWORD]).is.true;
    expect([Notifications.USER_SIGNIN, Notifications.USER_CHANGE_PASSWORD].some(k => p.notifications[k])).is.false;
  });

  it('should disable verifications if false passed', () => {
    p.setVerifications({
      [Verifications.USER_RESET_PASSWORD]: false,
      [Verifications.USER_CHANGE_PASSWORD]: false
    });

    expect(p.verifications[Verifications.TRANSACTION_SEND]).is.true;
    expect([Verifications.USER_RESET_PASSWORD, Verifications.USER_CHANGE_PASSWORD].some(k => p.verifications[k])).is.false;
  });
});

