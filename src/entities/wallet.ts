import { Column } from 'typeorm';
import { Token } from './token';

export class Wallet {
  @Column()
  index: number;

  @Column()
  ticker: string;

  @Column()
  address: string;

  @Column()
  balance: string;

  @Column()
  tokens: Token[];

  @Column()
  createdAt: number;

  static createWallet(data: any) {
    const wallet = new Wallet();
    wallet.index = -1;
    wallet.ticker = data.ticker;
    wallet.address = data.address;
    wallet.balance = data.balance || 0;
    wallet.tokens = data.tokens || [];
    wallet.createdAt = ~~(+new Date() / 1000);
    return wallet;
  }

  getTokenByContractAddress(contractAddress: string): Token {
    return this.tokens.filter(t => t.contractAddress.toLowerCase() === contractAddress.toLocaleLowerCase()).pop();
  }

  addToken(token: Token) {
    this.tokens = this.tokens || [];
    if (!this.tokens.filter(t => t.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()).length) {
      this.tokens.push(token);
    }
  }

  removeToken(token: Token) {
    this.tokens = this.tokens.filter(t => t.contractAddress.toLowerCase() !== token.contractAddress.toLowerCase());
  }
}
