import { Column } from 'typeorm';
import { Token } from './token';

export class Wallet {
  @Column()
  ticker: string;

  @Column()
  address: string;

  @Column()
  balance: string;

  @Column()
  salt: string;

  @Column()
  mnemonic: string;

  @Column()
  tokens: Token[];

  static createWallet(data: any) {
    const wallet = new Wallet();
    wallet.ticker = data.ticker;
    wallet.address = data.address;
    wallet.balance = data.balance || 0;
    wallet.salt = data.salt;
    wallet.mnemonic = data.mnemonic;
    wallet.tokens = data.tokens || [];
    return wallet;
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
