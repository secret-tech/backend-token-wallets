import * as chai from 'chai';

import { container } from '../../ioc.container';
import { AuthMiddleware } from '../request.auth';

chai.use(require('chai-http'));
const { expect, request } = chai;

describe('AuthMiddleware', () => {
  it('should create auth middleware', () => {
    let authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');
    expect(authMiddleware).is.instanceof(AuthMiddleware);
    expect(true).is.true;
  });
});
