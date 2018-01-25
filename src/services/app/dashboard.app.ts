import { inject, injectable } from 'inversify';

import config from '../../config';

import { AuthenticatedRequest } from '../../interfaces';
import { IncorrectMnemonic, InsufficientEthBalance, VerificationIsNotFound } from '../../exceptions';
import {
  TransactionRepositoryInterface,
  TransactionRepositoryType,
  allStatusesWithoutUnconfirmed
} from '../repositories/transaction.repository';
import { transformReqBodyToInvestInput } from './transformers';
import { User } from '../../entities/user';
import { VerificationClientType, VerificationClientInterface } from '../external/verify.client';
import { Web3ClientInterface, Web3ClientType } from '../external/web3.client';
import initiateBuyTemplate from '../../resources/emails/12_initiate_buy_erc20_code';
import { Erc20TokenService } from '../tokens/erc20token.service';
import { ETHEREUM_TRANSFER, ERC20_TRANSFER, TRANSACTION_STATUS_UNCONFIRMED, TRANSACTION_STATUS_PENDING } from '../../entities/transaction';
import { Verification } from '../../entities/verification';
import { Logger } from '../../logger';
import { Web3EventType, Web3EventInterface } from '../events/web3.events';
import { EmailQueueType, EmailQueueInterface } from '../queues/email.queue';

const TRANSACTION_TYPE_TOKEN_PURCHASE = 'token_purchase';

export const TRANSACTION_SCOPE = 'transaction';

export enum TransactionType {
  COINS = 'coins',
  TOKENS = 'tokens'
}

export interface TransactionSendData {
  to: string;
  type: string;
  amount: string;
  gasPrice?: string;
}

/**
 * Dashboard Service
 */
@injectable()
export class DashboardApplication {
  private logger = Logger.getInstance('DASHBOARD_APP');
  private erc20Token: Erc20TokenService;

  constructor(
    @inject(Web3EventType) private web3events: Web3EventInterface,
    @inject(EmailQueueType) private emailQueue: EmailQueueInterface,
    @inject(VerificationClientType) private verificationClient: VerificationClientInterface,
    @inject(Web3ClientType) private web3Client: Web3ClientInterface,
    @inject(TransactionRepositoryType) private transactionRepository: TransactionRepositoryInterface
  ) {
    this.erc20Token = new Erc20TokenService(web3Client);
  }

  /**
   * Get balances for addr
   * @param userWalletAddress
   */
  async balancesFor(userWalletAddress: string): Promise<any> {
    this.logger.debug('Get balances for', userWalletAddress);

    const [ethBalance, erc20TokenBalance] = await Promise.all([
      this.web3Client.getEthBalance(userWalletAddress),
      this.erc20Token.getBalanceOf(userWalletAddress)
    ]);

    return {
      ethBalance,
      erc20TokenBalance
    };
  }

  /**
   *
   */
  async getTransactionFee(gas: number): Promise<any> {
    this.logger.debug('Request transaction fee for gas', gas);

    return this.web3Client.getTransactionFee('' + gas);
  }

  /**
   * Get transaction history
   */
  async transactionHistory(user: User): Promise<any> {
    this.logger.debug('Request transactions history for', user.email);

    return this.transactionRepository.getAllByUserAndStatusIn(
      user,
      allStatusesWithoutUnconfirmed(),
      [ETHEREUM_TRANSFER, ERC20_TRANSFER]
    );
  }

  /**
   *
   * @param user
   * @param mnemonic
   * @param gas
   * @param gasPrice
   * @param ethAmount
   */
  async transactionSendInitiate(user: User, mnemonic: string, transData: TransactionSendData): Promise<any> {
    this.logger.debug('Initiate transaction', user.email, transData.type, transData.to);

    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.wallet.salt);
    if (account.address !== user.wallet.address) {
      throw new IncorrectMnemonic('Not correct mnemonic phrase');
    }

    const gas = '50000';
    const gasPrice = transData.gasPrice || await this.web3Client.getCurrentGasPrice();
    const txInput = transformReqBodyToInvestInput({gas, gasPrice, ethAmount: transData.amount}, user);
    txInput.to = transData.to;

    let txCheckInput = {...txInput};
    if (transData.type === ERC20_TRANSFER) {
      txCheckInput.amount = '0';
    }

    this.logger.debug('Check sufficient funds', user.email, transData.type, transData.to, txCheckInput.amount);

    if (!(await this.web3Client.sufficientBalance(txCheckInput))) {
      throw new InsufficientEthBalance('Insufficient funds to perform this operation and pay tx fee');
    }

    this.logger.debug('Init verification', user.email, transData.type, transData.to);

    const resultOfInitiateVerification = await this.verificationClient.initiateVerification(
      user.defaultVerificationMethod,
      {
        consumer: user.email,
        issuer: 'Jincor',
        template: {
          fromEmail: config.email.from.general,
          subject: 'You Transaction Validation Code to Use at Jincor.com',
          body: initiateBuyTemplate(user.name)
        },
        generateCode: {
          length: 6,
          symbolSet: ['DIGITS']
        },
        policy: {
          expiredOn: '01:00:00'
        },
        payload: {
          scope: TRANSACTION_SCOPE
        }
      }
    );

    const transaction = this.transactionRepository.newTransaction();
    transaction.data = JSON.stringify({gasPrice});
    transaction.amount = txInput.amount;
    transaction.from = user.wallet.address;
    transaction.to = txInput.to;
    transaction.type = transData.type;
    transaction.status = TRANSACTION_STATUS_UNCONFIRMED;
    transaction.verification = Verification.createVerification(resultOfInitiateVerification);

    this.logger.debug('Save unconfirmed transaction', user.email, transData.type, transData.to);

    await this.transactionRepository.save(transaction);

    return resultOfInitiateVerification;
  }

  /**
   *
   * @param verification
   * @param user
   * @param mnemonic
   * @param gas
   * @param gasPrice
   * @param ethAmount
   */
  async transactionSendVerify(verification: VerificationData, user: User, mnemonic: string): Promise<any> {
    this.logger.debug('Verify transaction', user.email);

    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.wallet.salt);
    if (account.address !== user.wallet.address) {
      throw new IncorrectMnemonic('Not correct mnemonic phrase');
    }

    const transaction = await this.transactionRepository.getByVerificationId(verification.verificationId);
    if (!transaction || transaction.status !== TRANSACTION_STATUS_UNCONFIRMED) {
      throw new VerificationIsNotFound('Verification is not found');
    }

    this.logger.debug('Check transaction verification', user.email, transaction.id);

    await this.verificationClient.validateVerification(
      user.defaultVerificationMethod,
      verification.verificationId,
      verification
    );

    const txId = transaction.id && transaction.id.toHexString();

    const gas = '50000';
    let gasPrice = '';
    try {
      gasPrice = JSON.parse(transaction.data).gasPrice || '100';
    } catch {
      gasPrice = await this.web3Client.getCurrentGasPrice();
    }
    const txInput = transformReqBodyToInvestInput({gas, gasPrice, ethAmount: transaction.amount}, user);

    let transactionHash;
    if (transaction.type === ERC20_TRANSFER) {
      txInput.to = config.contracts.erc20Token.address;
      txInput.amount = '0';

      this.logger.debug('Send tokens', user.email, txId);

      transactionHash = await this.erc20Token.transfer(gasPrice, user.wallet.address, transaction.to, transaction.amount, mnemonic, user.wallet.salt);
    } else {
      txInput.to = transaction.to;

      this.logger.debug('Send ethereums', user.email, txId);

      transactionHash = await this.web3Client.sendTransactionByMnemonic(
        txInput,
        mnemonic,
        user.wallet.salt
      );
    }

    transaction.transactionHash = transactionHash;
    transaction.status = TRANSACTION_STATUS_PENDING;

    this.logger.debug('Set transaction pending status', user.email, txId, transactionHash);

    await this.transactionRepository.save(transaction);

    return {
      transactionHash,
      status: TRANSACTION_STATUS_PENDING,
      type: transaction.type
    };
  }
}

const DashboardApplicationType = Symbol('DashboardApplicationService');
export { DashboardApplicationType };
