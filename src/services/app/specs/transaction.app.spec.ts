import * as chai from 'chai';
import * as TypeMoq from 'typemoq';

require('../../../../test/load.fixtures');

import { container } from '../../../ioc.container';
import { User } from '../../../entities/user';
import { getMongoRepository } from 'typeorm';
import { TransactionApplication, TransactionApplicationType } from '../transaction.app';
import { Web3Client, Web3ClientInterface, Web3ClientType } from '../../external/web3.client';
import { ETHEREUM_TRANSFER, ERC20_TRANSFER } from '../../../entities/transaction';
import { EncodedTransaction } from 'web3/types';
import Contract, { DummyContract } from '../../external/web3.contract';
import { VerifyActionService, VerifyActionServiceType } from '../../external/verify.action.service';
import { IncorrectMnemonic, NotCorrectTransactionRequest } from '../../../exceptions';

const { expect } = chai;

describe('Transaction App', () => {
  let user: User;
  const userPaymentPassword = '1q@W3e$R5';
  let web3Mock: TypeMoq.IMock<Web3ClientInterface>;
  let transaction: TransactionApplication;
  const transactionHash = '0x12345678';

  const commontInitTransactionData = {
    type: ETHEREUM_TRANSFER,
    from: '',
    to: '0xBd0cb067A75C23EFB290B4e223059Af8E4AF4fd8',
    amount: '1000',
    gas: '10000',
    gasPrice: '1'
  };

  beforeEach(async () => {
    user = await getMongoRepository(User).findOne({ email: 'user1@user.com' });
    commontInitTransactionData.from = user.wallets[0].address;

    container.snapshot();

    web3Mock = TypeMoq.Mock.ofType<Web3ClientInterface>(Web3Client);
    container.rebind<Web3ClientInterface>(Web3ClientType).toConstantValue(web3Mock.object);

    web3Mock.setup((x) => x.sufficientBalance(TypeMoq.It.isAny())).returns(async () => true);
    web3Mock.setup((x) => x.getAccountByMnemonicAndSalt(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(() => ({
        address: user.wallets[0].address
      }));
    web3Mock.setup((x) => x.signTransactionByAccount(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => ({ raw: '01234' } as EncodedTransaction));
    web3Mock.setup((x) => x.sendSignedTransaction(TypeMoq.It.isAny()))
      .returns(async () => transactionHash);
    web3Mock.setup((x) => x.getContract(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns((): Contract => {
        class c extends DummyContract {
          executeMethod(): Promise<EncodedTransaction> {
            return Promise.resolve({ raw: '0x01234' } as EncodedTransaction);
          }
        }
        return new c();
      });

    transaction = container.get<TransactionApplication>(TransactionApplicationType);
  });

  afterEach(() => {
    container.get<VerifyActionService>(VerifyActionServiceType)['redisClient'].quit();
    container.restore();
  });

  it('should get instance', () => {
    expect(transaction).is.instanceof(TransactionApplication);
  });

  it('should get transactions fee', async () => {
    web3Mock.setup(x => x.getTransactionFee(TypeMoq.It.isAnyString())).returns(async () => '2000');

    expect(await transaction.getTransactionFee(1000)).is.equal('2000');
  });

  it('should get transactions history', async () => {
    const history = await transaction.transactionHistory(user, user.wallets[0].address);

    expect(history.length).is.equal(1);
    expect(history[0].amount).is.equal('0.000000000000001');
  });

  it('should fail transfer ethereum with incorrected password', async () => {
    expect(transaction.transactionSendInitiate(user, 'invalid_payment_password', {
      ...commontInitTransactionData
    })).to.be.rejectedWith(IncorrectMnemonic);
  });

  it('should fail transfer ethereum yourself', async () => {
    expect(transaction.transactionSendInitiate(user, userPaymentPassword, {
      ...commontInitTransactionData,
      to: user.wallets[0].address
    })).to.be.rejectedWith(NotCorrectTransactionRequest);
  });

  it('should transfer ethereum', async () => {
    const verification = await transaction.transactionSendInitiate(user, userPaymentPassword, commontInitTransactionData);

    expect(verification).is.not.empty;

    const result = await transaction.transactionSendVerify({ verification }, user);

    expect(result).is.not.empty;
    expect(result.transactionHash).is.equal(transactionHash);
    expect(result.status).is.equal('pending');
    expect(result.type).is.equal(ETHEREUM_TRANSFER);
  });

  it('should fail transfer erc20 without contract address', async () => {
    expect(transaction.transactionSendInitiate(user, userPaymentPassword, {
      ...commontInitTransactionData,
      type: ERC20_TRANSFER,
    })).to.be.rejectedWith(NotCorrectTransactionRequest);
  });

  it('should transfer erc20 tokens', async () => {
    const verification = await transaction.transactionSendInitiate(user, userPaymentPassword, {
      ...commontInitTransactionData,
      type: ERC20_TRANSFER,
      contractAddress: '0xC31382Ef54B77bE67605980197b76a40417B5A74'
    });
    expect(verification).is.not.empty;

    const result = await transaction.transactionSendVerify({ verification }, user);

    expect(result).is.not.empty;

    expect(result.transactionHash).is.equal(transactionHash);
    expect(result.status).is.equal('pending');
    expect(result.type).is.equal(ERC20_TRANSFER);
  });
});
