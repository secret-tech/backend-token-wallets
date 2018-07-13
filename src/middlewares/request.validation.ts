import * as Joi from 'joi';
import { Response, Request, NextFunction } from 'express';
import { UNPROCESSABLE_ENTITY } from 'http-status';

import { responseErrorWithObject } from '../helpers/responses';
import * as fs from 'fs';

const options = {
  allowUnknown: true,
  language: {}
};

export const ethereumAddressValidator = Joi.string().regex(/^0x[\da-fA-F]{40,40}$/);

/**
 * Common template method for joi middleware
 *
 * @param scheme
 * @param req
 * @param res
 * @param next
 */
/* istanbul ignore next */
export function commonFlowRequestMiddleware(scheme: Joi.Schema, req: Request, res: Response, next: NextFunction) {
  const lang = 'en';
  const langPath = `../resources/locales/${lang}/validation.json`;

  let data: any = {};

  if (fs.existsSync(langPath)) {
    options.language = require(langPath);
  }

  if (req.method.toLocaleLowerCase() === 'get') {
    data = req.query;
  } else {
    data = req.body;
  }

  const result = Joi.validate(data || {}, scheme, options);

  if (result.error) {
    return responseErrorWithObject(res, {
      message: result.error.details[0].message
    }, UNPROCESSABLE_ENTITY);
  } else {
    return next();
  }
}

/**
 * Joi schema for verification validation.
 */
/* istanbul ignore next */
export const verificationValidateSchema = Joi.object().keys({
  verificationId: Joi.string().required(),
  code: Joi.string().required()
}).required();

/**
 * Default verification validator middleware.
 *
 * @param req
 * @param res
 * @param next
 */
/* istanbul ignore next */
export function verificationRequired(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    verification: verificationValidateSchema
  });

  commonFlowRequestMiddleware(schema, req, res, next);
}
