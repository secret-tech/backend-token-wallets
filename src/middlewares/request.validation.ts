import * as Joi from 'joi';
import { Response, Request, NextFunction } from 'express';
import { UNPROCESSABLE_ENTITY } from 'http-status';

import { base64decode } from '../helpers/helpers';
import { responseErrorWithObject } from '../helpers/responses';

const options = {
  allowUnknown: true
};

const ethAddress = Joi.string().regex(/^0x[\da-fA-F]{40,40}$/);

function commonFlowRequestMiddleware(scheme: Joi.Schema, data: any, res: Response, next: NextFunction) {
  const result = Joi.validate(data || {}, scheme, options);

  if (result.error) {
    return responseErrorWithObject(res, {
      'error': result.error,
      'details': result.value
    }, UNPROCESSABLE_ENTITY);
  } else {
    return next();
  }
}

const verificationSchema = Joi.object().keys({
  verificationId: Joi.string().required(),
  code: Joi.string().required()
}).required();

const passwordRegex = /^[a-zA-Z0\d!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]{8,}$/;

export function createUser(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().required().regex(passwordRegex),
    agreeTos: Joi.boolean().only(true).required()
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function activateUser(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
    verificationId: Joi.string().required(),
    code: Joi.string().required()
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function initiateLogin(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function verifyLogin(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    accessToken: Joi.string().required(),
    verification: Joi.object().keys({
      id: Joi.string().required(),
      code: Joi.string().required(),
      method: Joi.string().required()
    })
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function changePassword(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required().regex(passwordRegex)
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function resetPasswordInitiate(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().required().email()
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function resetPasswordVerify(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().required().email(),
    verification: verificationSchema
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function resetPasswordEnter(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().required(),
    resetId: Joi.string().required(),
    password: Joi.string().required().regex(passwordRegex),
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function verificationRequired(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    verification: verificationSchema
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function transactionFee(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    gas: Joi.string().required()
  });

  commonFlowRequestMiddleware(schema, req.query, res, next);
}

export function getErc20TokenInfo(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    contractAddress: ethAddress.required()
  });

  commonFlowRequestMiddleware(schema, req.query, res, next);
}

export function registerErc20Token(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    contractAddress: ethAddress.required(),
    name: Joi.string().optional(),
    symbol: Joi.string().required(),
    decimals: Joi.number().required().min(0).max(28)
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}

export function transactionSend(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    type: Joi.string().valid('eth_transfer', 'erc20_transfer').required(),
    contractAddress: ethAddress.optional(),
    mnemonic: Joi.string().required(),
    to: ethAddress.required(),
    gasPrice: Joi.string().optional(),
    amount: Joi.number().required().min(1e-10)
  });

  commonFlowRequestMiddleware(schema, req.body, res, next);
}
