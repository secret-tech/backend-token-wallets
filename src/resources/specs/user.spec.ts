import * as chai from 'chai';

import { Wallet } from '../../entities/wallet';
import { User } from '../../entities/user';
import { Notifications } from '../../entities/preferences';
import { Verifications } from '../../services/external/verify.action.service';
import { WalletNotFound } from '../../exceptions';

const { expect } = chai;

describe('User Entity', () => {
  const newWalletAddres = '0x1234567890123456789012345678901234567890';
  let user: User;

  beforeEach(() => {
    user = User.createUser({ _id: '1234', wallets: [{ address: '0x1234', index: 0 }] });
  });

  it('should notification check is true by default', () => {
    expect(user.isNotificationEnabled(Notifications.USER_CHANGE_PASSWORD)).is.true;
  });

  it('should verification check is true by default', () => {
    expect(user.isVerificationEnabled(Verifications.USER_SIGNIN)).is.true;
  });

  it('should add new wallet', () => {
    const address = newWalletAddres;
    user.addWallet(Wallet.createWallet({ address }));

    expect(user.wallets.length).is.equal(2);
    expect(user.wallets[1].address).is.equal(address);
  });

  it('should find first wallet', () => {
    const wallet = user.getWalletByAddress(user.wallets[0].address);

    expect(wallet).is.not.undefined;
    expect(user.wallets[0].address).is.equal(wallet.address);
  });

  it('shouldn\'t find wallet', () => {
    expect(user.getWalletByAddress(newWalletAddres)).is.undefined;
  });

  it('should get first single wallet', () => {
    expect(user.getSingleWalletOrThrowError()).is.not.undefined;
  });

  it('should throw to get single wallet if many user wallets', () => {
    user.addWallet(Wallet.createWallet({ address: newWalletAddres }));
    expect(() => user.getSingleWalletOrThrowError()).is.throw(WalletNotFound);
  });

  it('should get first wallet index', () => {
    user.wallets = [];
    expect(user.getNextWalletIndex()).is.equal(0);
  });

  it('should get second wallet index', () => {
    expect(user.getNextWalletIndex()).is.equal(1);
  });
});
