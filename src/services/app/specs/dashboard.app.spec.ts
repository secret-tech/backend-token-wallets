import * as chai from 'chai';
import * as TypeMoq from 'typemoq';

require('../../../../test/load.fixtures');

import { container } from '../../../ioc.container';
import { DashboardApplication, DashboardApplicationType } from '../dashboard.app';
import { User } from '../../../entities/user';
import { getMongoRepository } from 'typeorm';
import { Web3ClientInterface, Web3Client, Web3ClientType } from '../../external/web3.client';
import { Erc20TokenService } from '../../tokens/erc20token.service';
import Contract, { DummyContract } from '../../external/web3.contract';
import { VerifyActionService, VerifyActionServiceType } from '../../external/verify.action.service';

const { expect } = chai;

describe('Dashboard App', () => {
  let user: User;
  let web3Mock: TypeMoq.IMock<Web3ClientInterface>;
  let dashboard: DashboardApplication;

  beforeEach(async () => {
    user = await getMongoRepository(User).findOne({ email: 'user1@user.com' });
    container.snapshot();

    web3Mock = TypeMoq.Mock.ofType<Web3ClientInterface>(Web3Client);
    container.rebind<Web3ClientInterface>(Web3ClientType).toConstantValue(web3Mock.object);

    web3Mock.setup((x) => x.getEthBalance(TypeMoq.It.isAny())).returns(async (): Promise<string> => '1');
    web3Mock.setup(x => x.getContract(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns((): Contract => {
        class c extends DummyContract {
          async queryMethod(params: ExecuteContractConstantMethodInput) {
            return '2';
          }
        }
        return new c();
      });

    dashboard = container.get<DashboardApplication>(DashboardApplicationType);
  });

  afterEach(() => {
    container.get<VerifyActionService>(VerifyActionServiceType)['redisClient'].quit();
    container.restore();
  });


  it('should get instance', () => {
    expect(dashboard).is.instanceof(DashboardApplication);
  });

  it('should find already registered token', async () => {
    const info = await dashboard.getErc20TokenInfo('0xC31382Ef54B77bE67605980197b76a40417B5A74');

    expect(info).is.not.null;
    expect(info.symbol).is.equal('TOR');
  });

  it('should query info by web3 if token was not found', async () => {
    const info = await dashboard.getErc20TokenInfo('0xC31382Ef54B77bE67605980197b76a40417B5A75');

    expect(info).is.not.null;
    expect(info.symbol).is.equal('2');
  });

  it('should get balances', async () => {
    const balances = await dashboard.balancesFor(user, user.wallets[0].address);

    expect(balances).is.not.null;

    expect(balances.ethBalance).is.equal('1');

    expect(balances.erc20TokensBalance.length).is.equal(8);
    expect(balances.erc20TokensBalance[0].balance).is.equal('0.000000000000000002');
  });
});
