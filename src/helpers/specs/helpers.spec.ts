import * as chai from 'chai';
const util = require('util');

import { intersect, difference, chunkArray, processAsyncItemsByChunks, processAsyncIntRangeByChunks, CacheMethodResult } from '../helpers';

const { expect } = chai;

describe('Helpers', () => {
  const setTimeoutPromise = util.promisify(setTimeout);

  describe('Set operations', () => {
    it('should no intersect two set', () => {
      expect(intersect([1, 2, 3], [4, 5, 6])).is.deep.eq([]);
    });

    it('should intersect two set', () => {
      expect(intersect([1, 2, 3], [2, 3, 4])).is.deep.eq([2, 3]);
    });

    it('should no difference two set', () => {
      expect(difference([1, 2, 3, 4], [1, 2, 3, 4])).is.deep.eq([]);
    });

    it('should difference two set', () => {
      expect(difference([1, 2, 3, 4], [2, 3, 4])).is.deep.eq([1]);
    });
  });

  describe('Chunks', () => {
    it('should chunk an array', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 3)).is.deep.eq([[1, 2, 3], [4, 5]]);
      expect(chunkArray([1, 2, 3, 4, 5], 5)).is.deep.eq([[1, 2, 3, 4, 5]]);
    });
  });

  describe('Promise chunk', () => {
    it('should process range by chunks as async', async () => {
      const result = await processAsyncIntRangeByChunks(1, 5, 1, 2, (i) => setTimeoutPromise(0, i));
      expect(intersect([1, 2, 3, 4, 5], result)).is.deep.eq([1, 2, 3, 4, 5]);
    });

    it('should process an array by chunks as async', async () => {
      const result = await processAsyncItemsByChunks([1, 2, 3, 4, 5], 2, (i) => setTimeoutPromise(0, i));
      expect(intersect([1, 2, 3, 4, 5], result)).is.deep.eq([1, 2, 3, 4, 5]);
    });
  });

  describe('CacheMethodResult', () => {
    it('should cache result of promisified method', async () => {
      let cnt = 0;
      const c = new CacheMethodResult(1, 1000);
      const res = await c.run('k1', () => Promise.resolve(cnt++));
      expect(await c.run('k1', () => Promise.resolve(cnt++))).is.equal(0);
    });
  });
});

