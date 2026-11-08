'use strict';

const pino = require('pino');
const { env } = require('../config/env');

const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[redacted]',
  },
});

module.exports = logger;
