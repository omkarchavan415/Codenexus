'use strict';

const { badRequest } = require('../utils/errors');

/** validate({ body, query, params }) with zod schemas; parsed values replace the raw ones. */
const validate = (schemas) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const parsed = schemas[part].safeParse(req[part]);
    if (!parsed.success) {
      return next(
        badRequest(
          'Validation failed',
          'validation_error',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }
    if (part === 'query') {
      Object.defineProperty(req, 'query', { value: parsed.data, writable: true, configurable: true });
    } else {
      req[part] = parsed.data;
    }
  }
  return next();
};

module.exports = { validate };
