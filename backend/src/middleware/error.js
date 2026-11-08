'use strict';

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `Route ${req.method} ${req.originalUrl} not found` } });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON' } });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'too_large', message: 'Request body is too large' } });
  }
  if (err && err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Validation failed',
        details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
      },
    });
  }
  if (err && err.name === 'CastError') {
    return res.status(400).json({ error: { code: 'bad_id', message: 'Invalid identifier' } });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: { code: 'duplicate', message: 'That record already exists' } });
  }
  logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  return res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
};

module.exports = { notFoundHandler, errorHandler };
