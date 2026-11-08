'use strict';

const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/errors');
const auth = require('../services/authService');

const router = express.Router();

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/[0-9]/, 'Password needs a number');

const registerBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password,
});
const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
const tokenBody = z.object({ refreshToken: z.string().min(10) });

router.post(
  '/register',
  validate({ body: registerBody }),
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await auth.register(req.body);
    res.status(201).json({ user: user.toPublic(), accessToken, refreshToken });
  }),
);

router.post(
  '/login',
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await auth.login(req.body);
    res.json({ user: user.toPublic(), accessToken, refreshToken });
  }),
);

router.post(
  '/refresh',
  validate({ body: tokenBody }),
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await auth.rotate(req.body.refreshToken);
    res.json({ user: user.toPublic(), accessToken, refreshToken });
  }),
);

router.post(
  '/logout',
  validate({ body: tokenBody }),
  asyncHandler(async (req, res) => {
    await auth.logout(req.body.refreshToken);
    res.status(204).end();
  }),
);

module.exports = { router, passwordSchema: password };
