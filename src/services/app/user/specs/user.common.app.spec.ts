import * as chai from 'chai';
import * as TypeMoq from 'typemoq';

require('../../../../../test/load.fixtures');

import { container } from '../../../../ioc.container';
import { User } from '../../../../entities/user';
import { getMongoRepository } from 'typeorm';
import { EncodedTransaction } from 'web3/types';
import Contract, { DummyContract } from '../../../external/web3.contract';
import { UserCommonApplicationType, UserCommonApplication } from '../user.common.app';

const { expect } = chai;

describe('User Common App', () => {
  let user: User;
  let userCommon: UserCommonApplication;

  beforeEach(async () => {
    user = await getMongoRepository(User).findOne({ email: 'user1@user.com' });
    container.snapshot();

    userCommon = container.get<UserCommonApplication>(UserCommonApplicationType);
  });

  afterEach(() => {
    container.restore();
  });

  it('should get instance', () => {
    expect(userCommon).is.instanceof(UserCommonApplication);
  });

  it('should get user info', async () => {
    const userInfo = await userCommon.getUserInfo(user);
    expect(userInfo.email).is.equal(user.email);
  });

  it('should register new token', async () => {
    const token = await userCommon.registerToken(user, {
      contractAddress: '0xc20f363f721fe8b35cc2aafd18df7156c775d642',
      decimals: 18,
      symbol: 'TOK',
      name: 'TOKEN'
    });
    expect(token.symbol).is.equal('TOK');
  });
});
