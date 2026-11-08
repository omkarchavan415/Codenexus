'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { conflict, unauthorized } = require('../utils/errors');

// A throwaway hash so login takes the same time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

function signAccess(user) {
  return jwt.sign({ typ: 'access', role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: env.ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
  });
}

async function issueRefresh(user, family = crypto.randomUUID()) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ jti, family, user: user._id, expiresAt });
  const token = jwt.sign({ typ: 'refresh', fam: family }, env.JWT_REFRESH_SECRET, {
    subject: String(user._id),
    jwtid: jti,
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
    algorithm: 'HS256',
  });
  return token;
}

async function issueTokens(user, family) {
  return { accessToken: signAccess(user), refreshToken: await issueRefresh(user, family) };
}

async function register({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw conflict('An account with that email already exists', 'email_taken');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    if (err.code === 11000) throw conflict('An account with that email already exists', 'email_taken');
    throw err;
  }
  return { user, ...(await issueTokens(user)) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Incorrect email or password', 'bad_credentials');
  return { user, ...(await issueTokens(user)) };
}

async function revokeFamily(family) {
  await RefreshToken.updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/**
 * Refresh token rotation. Each refresh token works once. Presenting one that was already used
 * means it may have been stolen, so the whole token family is revoked.
 */
async function rotate(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw unauthorized('Invalid refresh token', 'token_invalid');
  }
  if (payload.typ !== 'refresh') throw unauthorized('Invalid refresh token', 'token_invalid');

  const consumed = await RefreshToken.findOneAndUpdate(
    { jti: payload.jti, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!consumed) {
    await revokeFamily(payload.fam);
    throw unauthorized('Refresh token was already used', 'token_reused');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  const tokens = await issueTokens(user, consumed.family);
  const next = jwt.decode(tokens.refreshToken);
  await RefreshToken.updateOne({ jti: payload.jti }, { $set: { replacedBy: next.jti } });
  return { user, ...tokens };
}

async function logout(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    await revokeFamily(payload.fam);
  } catch (err) {
    // Logging out with a bad or expired token is still a successful logout.
  }
}

async function revokeAllForUser(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

module.exports = { register, login, rotate, logout, revokeAllForUser, signAccess };
