import * as chai from 'chai';

import { Wallet } from '../../entities/wallet';
import { User } from '../../entities/user';
import { Notifications } from '../../entities/preferences';
import { Verifications } from '../../services/external/verify.action.service';

const { expect } = chai;

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = User.createUser({ _id: '1234' });
  });

  it('should notification check is true by default', () => {
    expect(user.isNotificationEnabled(Notifications.USER_CHANGE_PASSWORD)).is.true;
  });

  it('should verification check is true by default', () => {
    expect(user.isVerificationEnabled(Verifications.USER_SIGNIN)).is.true;
  });

  it('should add new wallet', () => {
    const address = '0x1234567890123456789012345678901234567890';
    user.addWallet(Wallet.createWallet({ address }));

    expect(user.wallets.length).is.equal(1);
    expect(user.wallets[0].address).is.equal(address);
  });
});

