import { inject, injectable } from 'inversify';

import config from '../../config';

import { AuthenticatedRequest } from '../../interfaces';
import { IncorrectMnemonic, InsufficientEthBalance, VerificationIsNotFound, NotCorrectTransactionRequest, WalletNotFound } from '../../exceptions';
import {
  TransactionRepositoryInterface,
  TransactionRepositoryType,
  allStatuses
} from '../repositories/transaction.repository';
import { User } from '../../entities/user';
import { Web3ClientInterface, Web3ClientType } from '../external/web3.client';
import { Erc20TokenService } from '../tokens/erc20token.service';
import { ETHEREUM_TRANSFER, ERC20_TRANSFER, TRANSACTION_STATUS_PENDING, Transaction } from '../../entities/transaction';
import { Logger } from '../../logger';
import { Web3EventType, Web3EventInterface } from '../events/web3.events';
import { EmailQueueType, EmailQueueInterface } from '../queues/email.queue';
import { CacheMethodResult } from '../../helpers/helpers';
import { VerificationInitiateContext } from '../external/verify.context.service';
import { buildScopeEmailVerificationInitiate, buildScopeGoogleAuthVerificationInitiate } from '../../verify.cases';
import { VerifyActionServiceType, VerifyActionService, Verifications, VerifyMethod } from '../external/verify.action.service';
import { EncodedTransaction } from 'web3/types';
import { toEthChecksumAddress, MasterKeySecret, decryptTextByUserMasterKey } from '../crypto';
import { fromUnitValueToWei, fromWeiToUnitValue } from '../tokens/helpers';
import { Token } from '../../entities/token';

export interface TransactionSendData {
  from?: string;
  to: string;
  type: string;
  amount: string;
  contractAddress?: string;
  gas?: string;
  gasPrice?: string;
}

const transactionsCache = new CacheMethodResult(4096, 8000);

interface TransactionSendPayload {
  userEmail: string;
  tx: EncodedTransaction;
  amount: string;
  from: string;
  contractAddress: string;
  to: string;
  type: string;
  gas: string;
  gasPrice: string;
}

/**
 * Transaction Service
 */
@injectable()
export class TransactionApplication {
  private logger = Logger.getInstance('TRANSACTION_APP');

  constructor(
    @inject(Web3EventType) private web3events: Web3EventInterface,
    @inject(EmailQueueType) private emailQueue: EmailQueueInterface,
    @inject(VerifyActionServiceType) private verifyAction: VerifyActionService,
    @inject(Web3ClientType) private web3Client: Web3ClientInterface,
    @inject(TransactionRepositoryType) private transactionRepository: TransactionRepositoryInterface
  ) {
  }

  // @TODO: DRY
  private newInitiateVerification(scope: string, consumer: string) {
    return buildScopeGoogleAuthVerificationInitiate(
      new VerificationInitiateContext(scope), { consumer }
    );
  }

  /**
   *
   */
  async getTransactionFee(gas: number): Promise<any> {
    this.logger.debug('Request transaction fee for gas', gas);

    return transactionsCache.run('gasFee' + gas, () => {
      return this.web3Client.getTransactionFee('' + gas);
    });
  }

  /**
   *
   * @param user
   */
  private getKnownUserErc20Tokens(user: User, wallet: Wallet): { [k: string]: Token; } {
    const knownUserTokens = {};

    wallet.tokens.forEach(t => {
      const contractAddress = toEthChecksumAddress(t.contractAddress);
      knownUserTokens[contractAddress] = t;
      delete knownUserTokens[contractAddress].balance;
    });

    return knownUserTokens;
  }

  /**
   * Get transaction history
   */
  async transactionHistory(user: User, walletAddress: string): Promise<any> {
    walletAddress = walletAddress || user.getSingleWalletOrThrowError().address;

    this.logger.debug('[transactionHistory] Request transactions history', {
      meta: { email: user.email, walletAddress }
    });

    const wallet = user.getWalletByAddress(walletAddress);
    if (!wallet) {
      throw new WalletNotFound('Wallet not found: ' + walletAddress);
    }

    return transactionsCache.run('thist' + user.id.toString() + walletAddress, () => {

      const knownUserTokens = this.getKnownUserErc20Tokens(user, wallet);

      return this.transactionRepository.getAllByWalletAndStatusIn(
        wallet,
        allStatuses(),
        [ETHEREUM_TRANSFER, ERC20_TRANSFER],
        50 // @TODO: Customize it!
      ).then(transactions => {
        return transactions.map<any>(tx => {
          const contractAddress = tx.contractAddress ? toEthChecksumAddress(tx.contractAddress) : '';
          return {
            ...tx, token: knownUserTokens[contractAddress],
            amount: tx.type === ERC20_TRANSFER && knownUserTokens[contractAddress] ?
              fromWeiToUnitValue(tx.amount, knownUserTokens[contractAddress].decimals || 0) :
              tx.amount,
            details: undefined,
            // remove contract address if token is known
            contractAddress: tx.type === ERC20_TRANSFER && !knownUserTokens[contractAddress] ?
              contractAddress :
              undefined
          };
        });
      });
    });
  }

  /**
   *
   * @param user
   * @param mnemonic
   * @param gas
   * @param gasPrice
   * @param ethAmount
   */
  async transactionSendInitiate(user: User, paymentPassword: string, transData: TransactionSendData): Promise<any> {
    transData.from = transData.from || user.getSingleWalletOrThrowError().address;

    const logger = this.logger.sub({
      email: user.email, type: transData.type, from: transData.from, to: transData.to, amount: transData.amount
    }, '[transactionSendInitiate] ');

    logger.debug('Initiate transaction');

    const wallet = user.getWalletByAddress(transData.from);
    if (!wallet) {
      throw new WalletNotFound('Wallet not found: ' + transData.from);
    }

    const msc = new MasterKeySecret();

    const mnemonic = decryptTextByUserMasterKey(msc, user.mnemonic, paymentPassword, user.securityKey);
    if (!mnemonic) {
      throw new IncorrectMnemonic('Incorrect payment password');
    }

    const salt = decryptTextByUserMasterKey(msc, user.salt, paymentPassword, user.securityKey);
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt, wallet.index);
    if (account.address !== wallet.address) {
      throw new IncorrectMnemonic('Incorrect payment password, invalid address');
    }

    if (transData.to.toLowerCase() === account.address.toLowerCase()) {
      throw new NotCorrectTransactionRequest('Senseless operation, to send to yourself');
    }

    if (transData.type === ERC20_TRANSFER && !transData.contractAddress) {
      throw new NotCorrectTransactionRequest('Empty token address');
    }

    let amount = ('' + transData.amount).replace(/0+$/, ''); // remove last zeroes
    if (transData.type === ERC20_TRANSFER) {
      const token = wallet.getTokenByContractAddress(transData.contractAddress);
      amount = fromUnitValueToWei(amount, token && token.decimals || 0);
    }

    const gas = '' + Math.max(+transData.gas, 30000);
    const gasPrice = '' + (Math.max(+transData.gasPrice, 0) || await this.web3Client.getCurrentGasPrice());
    const txInput = {
      from: wallet.address,
      to: transData.to,
      amount: '' + amount,
      gas,
      gasPrice
    };

    let txCheckBalanceInput = { ...txInput };
    if (transData.type === ERC20_TRANSFER) {
      txCheckBalanceInput.amount = '0';
    }

    logger.debug('Check sufficient funds');

    if (!(await this.web3Client.sufficientBalance(txCheckBalanceInput))) {
      throw new InsufficientEthBalance('Insufficient funds to perform this operation and pay tx fee');
    }

    let signedTransaction: EncodedTransaction;
    if (transData.type === ERC20_TRANSFER) {
      logger.debug('Prepare to send tokens');

      signedTransaction = await new Erc20TokenService(this.web3Client, toEthChecksumAddress(transData.contractAddress))
        .transfer(account, { gas, gasPrice: txInput.gasPrice }, txInput.to, txInput.amount);
    } else {
      logger.debug('Prepare to send ethereums');

      signedTransaction = await this.web3Client.signTransactionByAccount({
        from: account.address,
        to: txInput.to,
        amount: txInput.amount,
        gas,
        gasPrice: txInput.gasPrice
      },
        account
      );
    }

    logger.debug('Init verification');

    const initiateVerification = this.newInitiateVerification(Verifications.TRANSACTION_SEND, user.email);
    if (user.defaultVerificationMethod === VerifyMethod.EMAIL) {
      buildScopeEmailVerificationInitiate(
        initiateVerification,
        {
          user,
          transactionType: transData.type === ERC20_TRANSFER ? 'tokens' : 'ethereum'
        }
      );
    }

    const txPayload: TransactionSendPayload = {
      userEmail: user.email,
      tx: signedTransaction,
      amount: txInput.amount,
      from: wallet.address,
      gas,
      gasPrice,
      contractAddress: toEthChecksumAddress(transData.contractAddress),
      to: txInput.to,
      type: transData.type
    };

    if (!user.isVerificationEnabled(Verifications.TRANSACTION_SEND)) {
      initiateVerification.setMethod(VerifyMethod.INLINE);
    }

    const { verifyInitiated } = await this.verifyAction.initiate(initiateVerification, txPayload);
    return verifyInitiated;
  }

  /**
   *
   * @param verification
   * @param user
   */
  async transactionSendVerify(verify: VerificationInput, user: User): Promise<any> {
    this.logger.debug('[transactionSendVerify] Check transaction verification', { meta: { email: user.email } });

    const { verifyPayload } = await this.verifyAction.verify(Verifications.TRANSACTION_SEND, verify.verification);
    const txPayload = verifyPayload as TransactionSendPayload;

    let logger = this.logger.sub({
      email: user.email,
      type: txPayload.type,
      from: txPayload.from,
      to: txPayload.to,
      amount: txPayload.amount,
      contractAddress: txPayload.contractAddress
    }, '[transactionSendVerify] ');

    logger.debug('Execute send transaction');

    // mistake (or old version) in web3/types
    const transactionHash = await this.web3Client.sendSignedTransaction((txPayload.tx as any).rawTransaction);

    logger = logger.addMeta({ transactionHash });
    logger.debug('Set transaction pending status');

    const transaction = Transaction.createTransaction({
      ...txPayload,
      transactionHash,
      details: JSON.stringify({ gas: txPayload.gas, gasPrice: txPayload.gasPrice }),
      status: TRANSACTION_STATUS_PENDING
    });
    transaction.timestamp = ~~(+new Date() / 1000);

    await this.transactionRepository.save(transaction);

    return {
      transactionHash,
      status: transaction.status,
      type: transaction.type
    };
  }
}

const TransactionApplicationType = Symbol('TransactionApplicationService');
export { TransactionApplicationType };
