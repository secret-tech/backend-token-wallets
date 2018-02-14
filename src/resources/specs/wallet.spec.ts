import * as chai from 'chai';

import { Token } from '../../entities/token';
import { Wallet } from '../../entities/wallet';

const { expect } = chai;

describe('Wallet Entity', () => {
  let w: Wallet;

  beforeEach(() => {
    w = Wallet.createWallet({});
    w.addToken(Token.createToken({contractAddress: '0xabcdabcd01abcdabcd01abcdabcd01abcdabcd01'}));
  });

  it('should get token by contract address', () => {
    expect(w.getTokenByContractAddress('0xABcdabcd01abcdabcd01abcdabcd01abcdabcd01')).is.not.undefined;
  });

  it('should add token', () => {
    w.addToken(Token.createToken({contractAddress: '0xabcdabcd01abcdabcd01abcdabcd01abcdabcd02'}));

    expect(w.tokens.length).is.equal(2);
  });

  it('should skip if existing', () => {
    w.addToken(Token.createToken({contractAddress: '0xabcdabcd01abcdabcd01abcdabcd01abcdabcd01', name: 'TOKEN'}));

    expect(w.tokens.length).is.equal(1);
    expect(w.tokens[0].name).is.undefined;
  });

  it('should remove token', () => {
    w.removeToken(w.getTokenByContractAddress('0xabcdabcd01abcdabcd01abcdabcd01abcdabcd01'));

    expect(w.tokens).is.empty;
  });
});
