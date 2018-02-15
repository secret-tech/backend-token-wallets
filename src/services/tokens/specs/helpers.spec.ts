import * as chai from 'chai';

import { fromWeiToUnitValue, fromUnitValueToWei, decimalsToUnitMap } from '../helpers';

const { expect } = chai;

describe('Helpers', () => {
  it('should get gwei for nearest decimals', () => {
    expect(decimalsToUnitMap(0)).is.equal('wei');
    expect(decimalsToUnitMap(8)).is.equal('picoether');
    expect(decimalsToUnitMap(30)).is.equal('tether');
  });

  it('should convert from wei to unit', () => {
    expect(fromWeiToUnitValue('100000', 6)).is.equal('0.1');
  });

  it('should not convert from wei to unit when invalid digits', () => {
    expect(() => fromWeiToUnitValue('100000', 5)).to.throw();
  });

  it('should not convert from invalid wei to unit', () => {
    expect(() => fromWeiToUnitValue('0.0001', 3)).to.throw();
  });

  it('should convert from unit to wei', () => {
    expect(fromUnitValueToWei('0.1', 6)).is.equal('100000');
  });
});

