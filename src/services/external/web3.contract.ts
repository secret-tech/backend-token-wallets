import { Web3Client } from './web3.client';

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
  async deploy(params: DeployContractInput): Promise<string> {
    const contract = new this.web3.eth.Contract(this.abi);

    const deploy = contract.deploy({
      data: params.byteCode,
      arguments: params.constructorArguments
    });

    const txInput = {
      from: params.from,
      to: null,
      amount: '0',
      gas: (await deploy.estimateGas()) + 300000, // @TODO: Check magic const
      gasPrice: params.gasPrice,
      data: deploy.encodeABI()
    };

    return this.web3client.sendTransactionByMnemonic(txInput, params.mnemonic, params.salt);
  }

  /**
   *
   * @param params
   */
  async executeMethod(params: ExecuteContractMethodInput): Promise<string> {
    const method = this.contract.methods[params.methodName](...params.arguments);
    const estimatedGas = await method.estimateGas({ from: params.from });

    const txInput = {
      from: params.from,
      to: this.address,
      amount: params.amount,
      gas: estimatedGas + 200000, // @TODO: Check magic const
      gasPrice: params.gasPrice,
      data: method.encodeABI()
    };

    return this.web3client.sendTransactionByMnemonic(txInput, params.mnemonic, params.salt);
  }

  /**
   *
   * @param params
   */
  queryMethod(params: ExecuteContractConstantMethodInput): Promise<any> {
    const method = this.contract.methods[params.methodName](...params.arguments);
    return method.call();
  }

  onEvent(eventName) {
    return this.contract.events[eventName]();
  }
}
