'use strict';

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const User = require('../models/User');
const { unauthorized, forbidden, asyncHandler } = require('../utils/errors');

/** Verifies the bearer access token and loads the user. */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw unauthorized(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token', 'token_invalid');
  }
  if (payload.typ !== 'access') throw unauthorized('Invalid access token', 'token_invalid');

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  return next();
};

module.exports = { authenticate, requireRole };
