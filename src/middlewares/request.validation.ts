import * as Joi from 'joi';
import { Response, Request, NextFunction } from 'express';
import { UNPROCESSABLE_ENTITY } from 'http-status';

import { base64decode } from '../helpers/helpers';
import { responseErrorWithObject } from '../helpers/responses';

const options = {
  allowUnknown: true
};

const ethAddress = Joi.string().regex(/^0x[\da-fA-F]{40,40}$/);

function commonFlowRequestMiddleware(scheme: Joi.Schema, req: Request, res: Response, next: NextFunction) {
  const result = Joi.validate(req.body || {}, scheme, options);

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
  code: Joi.string().required(),
  method: Joi.string().required()
}).required();

const passwordRegex = /^[a-zA-Z0\d!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]{8,}$/;

export function createUser(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().required().regex(passwordRegex),
    agreeTos: Joi.boolean().only(true).required()
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function activateUser(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
    verificationId: Joi.string().required(),
    code: Joi.string().required()
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function initiateLogin(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  commonFlowRequestMiddleware(schema, req, res, next);
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

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function changePassword(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required().regex(passwordRegex)
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function resetPasswordInitiate(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().required().email()
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function resetPasswordVerify(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().regex(passwordRegex),
    verification: verificationSchema
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function verificationRequired(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    verification: verificationSchema
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function transactionFee(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    gas: Joi.number().required().min(1)
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}

export function transactionSend(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    type: Joi.string().valid('eth_transfer', 'erc20_transfer').required(),
    mnemonic: Joi.string().required(),
    to: ethAddress.required(),
    gasPrice: Joi.number().optional().min(100),
    amount: Joi.number().required().min(1e-10)
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}
