'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const mongoose = require('mongoose');
const { env } = require('./config/env');
const logger = require('./utils/logger');
const { createGeminiClient } = require('./services/gemini');
const { createGenerationQueue } = require('./services/generationQueue');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const { router: authRouter } = require('./routes/auth');
const meRouter = require('./routes/me');
const catalogRouter = require('./routes/catalog');
const { createTestsRouter } = require('./routes/tests');
const roadmapRouter = require('./routes/roadmap');
const { createAdminRouter } = require('./routes/admin');

/**
 * Builds the Express app. Gemini and the generation queue can be injected so tests never touch
 * the network.
 */
function createApp({ gemini, generationQueue } = {}) {
  const geminiClient =
    gemini ||
    createGeminiClient({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, timeoutMs: env.GEMINI_TIMEOUT_MS });
  const queue = generationQueue || createGenerationQueue({ gemini: geminiClient });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin and server-to-server calls have no Origin header.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  // Bulk question imports can be larger than ordinary API bodies.
  app.use('/api/admin/questions/import', express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '200kb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/health', (req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      db: dbUp ? 'up' : 'down',
      gemini: geminiClient.enabled ? 'configured' : 'not_configured',
      time: new Date().toISOString(),
    });
  });

  if (env.RATE_LIMIT_ENABLED) {
    const limiter = (max) =>
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: { code: 'rate_limited', message: 'Too many requests, please slow down' } },
      });
    app.use('/api', limiter(env.RATE_LIMIT_MAX));
    app.use('/api/auth', limiter(env.AUTH_RATE_LIMIT_MAX));
  }

  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api', catalogRouter);
  app.use('/api/tests', createTestsRouter({ generationQueue: queue }));
  app.use('/api/roadmap', roadmapRouter);
  app.use('/api/admin', createAdminRouter({ gemini: geminiClient }));
  app.use('/api', roadmapRouter.insights);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
