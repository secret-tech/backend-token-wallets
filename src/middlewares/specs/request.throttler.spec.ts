import * as chai from 'chai';

import { ThrottlerMiddleware } from '../request.throttler';

const { expect } = chai;

describe('ThrottlerMiddleware', () => {
  it('should create throttler middleware', async () => {
    const throttlerMiddleware = new ThrottlerMiddleware();
    throttlerMiddleware['redisClient'].quit();
  });
});
