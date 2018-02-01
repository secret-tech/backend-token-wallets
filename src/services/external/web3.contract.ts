import { Web3Client } from './web3.client';
import { EncodedTransaction, Account } from 'web3/types';

/**
 *
 */
export default class Contract {
  protected contract: any;

  /**
   *
   * @param web3
   * @param address
   * @param abi
   */
  constructor(private web3client: Web3Client, private web3: any, private abi: any[], private address?: string) {
    this.contract = new this.web3.eth.Contract(this.abi, this.address);
  }

  /**
   *
   * @param params
   */
  async deploy(params: DeployContractInput, account: Account): Promise<EncodedTransaction> {
    const contract = new this.web3.eth.Contract(this.abi);

    const deploy = contract.deploy({
      data: params.byteCode,
      arguments: params.constructorArguments
    });

    const txInput = {
      from: account.address,
      to: null,
      amount: '0',
      gas: params.gas || (await deploy.estimateGas() + 300000),
      gasPrice: params.gasPrice,
      data: deploy.encodeABI()
    };

    return this.web3client.signTransactionByAccount(txInput, account);
  }

  /**
   *
   * @param params
   */
  async executeMethod(params: ExecuteContractMethodInput, account: Account): Promise<EncodedTransaction> {
    const method = this.contract.methods[params.methodName](...params.arguments);

    const txInput = {
      from: account.address,
      to: this.address,
      amount: params.amount,
      gas: params.gas || (await method.estimateGas({ from: account.address }) + 50000),
      gasPrice: params.gasPrice,
      data: method.encodeABI()
    };

    return this.web3client.signTransactionByAccount(txInput, account);
  }

  /**
   *
   * @param params
   */
  queryMethod(params: ExecuteContractConstantMethodInput): Promise<any> {
    const method = this.contract.methods[params.methodName](...params.arguments);
    return method.call();
  }

  onEvent(name: string) {
    return this.contract.events[name]();
  }
}
