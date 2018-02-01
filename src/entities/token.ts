import { Column } from 'typeorm';
import { toEthChecksumAddress } from '../services/crypto';

export class Token {
  @Column()
  public contractAddress: string;

  @Column()
  public symbol: string;

  @Column()
  public name: string;

  @Column()
  public decimals: number;

  @Column()
  public balance: string;

  static createToken(data: any) {
    const t = new Token();
    t.contractAddress = toEthChecksumAddress(data.contractAddress);
    t.name = data.name;
    t.symbol = data.symbol;
    t.decimals = data.decimals || 18;
    t.balance = '0';
    return t;
  }
}
