import * as chai from 'chai';
import { Request as ExpRequest } from 'express';

import { container } from '../../ioc.container';
import { getRemoteIpFromRequest } from '../request.common';

chai.use(require('chai-http'));
const { expect, request } = chai;

describe('CommonMiddleware', () => {
  class Request {
    ip: string;
    _headers: { [k: string]: string; } = {};
    setHeader(n: string, v: string) {
      this._headers[n] = v;
    }
    header(n: string) {
      return this._headers[n];
    }
  }

  let req: Request;
  beforeEach(() => {
    req = new Request();
  })

  it('should extract ip from cf request', () => {
    req.setHeader('cf-connecting-ip', '10.0.0.1');
    expect(getRemoteIpFromRequest(req as ExpRequest)).is.equal('10.0.0.1');
  });

  it('should extract ip from rev-proxy request', () => {
    req.setHeader('x-real-ip', '10.0.0.1');
    expect(getRemoteIpFromRequest(req as ExpRequest)).is.equal('10.0.0.1');
  });

  it('should extract ip from simple ip request', () => {
    req.ip = '10.0.0.1';
    expect(getRemoteIpFromRequest(req as ExpRequest)).is.equal('10.0.0.1');
  });
});
