import { inject, injectable } from 'inversify';

import config from '../../config';

import { AuthenticatedRequest } from '../../interfaces';
import { IncorrectMnemonic, InsufficientEthBalance, VerificationIsNotFound, NotCorrectTransactionRequest } from '../../exceptions';
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
  private getKnownUserErc20Tokens(user: User): { [k: string]: Token; } {
    const knownUserTokens = {};

    user.wallets[0].tokens.forEach(t => {
      const contractAddress = toEthChecksumAddress(t.contractAddress);
      knownUserTokens[contractAddress] = t;
      delete knownUserTokens[contractAddress].balance;
    });

    return knownUserTokens;
  }

  /**
   * Get transaction history
   */
  async transactionHistory(user: User): Promise<any> {
    this.logger.debug('Request transactions history for', user.email);

    return transactionsCache.run('thist' + user.id, () => {

      const knownUserTokens = this.getKnownUserErc20Tokens(user);

      return this.transactionRepository.getAllByWalletAndStatusIn(
        user.wallets[0],
        allStatuses(),
        [ETHEREUM_TRANSFER, ERC20_TRANSFER]
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
  async transactionSendInitiate(user: User, paymantPassword: string, transData: TransactionSendData): Promise<any> {
    this.logger.debug('Initiate transaction', user.email, transData.type, transData.to);

    const msc = new MasterKeySecret();

    const mnemonic = decryptTextByUserMasterKey(msc, user.wallets[0].mnemonic, paymantPassword, user.wallets[0].securityKey);
    if (!mnemonic) {
      throw new IncorrectMnemonic('Incorrect payment password');
    }

    const salt = decryptTextByUserMasterKey(msc, user.wallets[0].salt, paymantPassword, user.wallets[0].securityKey);
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt);
    if (account.address !== user.wallets[0].address) {
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
      const token = user.wallets[0].getTokenByContractAddress(transData.contractAddress);
      amount = fromUnitValueToWei(amount, token && token.decimals || 0);
    }

    const gas = '' + Math.max(+transData.gas, 30000);
    const gasPrice = '' + (Math.max(+transData.gasPrice, 0) || await this.web3Client.getCurrentGasPrice());
    const txInput = {
      from: user.wallets[0].address,
      to: transData.to,
      amount: '' + amount,
      gas,
      gasPrice
    };

    let txCheckBalanceInput = { ...txInput };
    if (transData.type === ERC20_TRANSFER) {
      txCheckBalanceInput.amount = '0';
    }

    this.logger.debug('Check sufficient funds', user.email, transData.type, transData.to);

    if (!(await this.web3Client.sufficientBalance(txCheckBalanceInput))) {
      throw new InsufficientEthBalance('Insufficient funds to perform this operation and pay tx fee');
    }

    let signedTransaction: EncodedTransaction;
    if (transData.type === ERC20_TRANSFER) {
      this.logger.debug('Prepare to send tokens', user.email);

      signedTransaction = await new Erc20TokenService(this.web3Client, toEthChecksumAddress(transData.contractAddress))
        .transfer(account, { gas, gasPrice: txInput.gasPrice }, txInput.to, txInput.amount);
    } else {
      this.logger.debug('Prepare to send ethereums', user.email);

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

    this.logger.debug('Init verification', user.email, transData.type, transData.to);

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
      from: user.wallets[0].address,
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
    this.logger.debug('Check transaction verification', user.email);

    const { verifyPayload } = await this.verifyAction.verify(Verifications.TRANSACTION_SEND, verify.verification);
    const txPayload = verifyPayload as TransactionSendPayload;

    this.logger.debug('Execute send transaction for', user.email, txPayload.type, txPayload.to);

    // mistake (or old version) in web3/types
    const transactionHash = await this.web3Client.sendSignedTransaction((txPayload.tx as any).rawTransaction);

    this.logger.debug('Set transaction pending status for', user.email, transactionHash);

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
