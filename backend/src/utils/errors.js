'use strict';

class AppError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code || 'error';
    this.details = details;
  }
}

const badRequest = (msg, code, details) => new AppError(400, msg, code || 'bad_request', details);
const unauthorized = (msg = 'Authentication required', code) => new AppError(401, msg, code || 'unauthorized');
const forbidden = (msg = 'You do not have permission to do that') => new AppError(403, msg, 'forbidden');
const notFound = (msg = 'Not found') => new AppError(404, msg, 'not_found');
const conflict = (msg, code) => new AppError(409, msg, code || 'conflict');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler };
