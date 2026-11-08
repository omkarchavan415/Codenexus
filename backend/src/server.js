'use strict';

const mongoose = require('mongoose');
const { env } = require('./config/env');
const logger = require('./utils/logger');
const { createApp } = require('./app');
const { createGeminiClient } = require('./services/gemini');
const { createGenerationQueue } = require('./services/generationQueue');
const cache = require('./services/cache');

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  logger.info('MongoDB connected');
  // Build indexes up front so unique constraints (email, question hash, roadmap version) are enforced.
  await mongoose.syncIndexes();

  const gemini = createGeminiClient({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, timeoutMs: env.GEMINI_TIMEOUT_MS });
  let generationQueue;
  if (env.REDIS_URL) {
    // Redis available: durable BullMQ generation jobs and a shared cache.
    const { createBullGenerationQueue } = require('./services/bullQueue');
    generationQueue = createBullGenerationQueue({ gemini, redisUrl: env.REDIS_URL });
    cache.attachRedis(generationQueue.connection);
    logger.info('Redis connected: BullMQ generation queue and shared cache enabled');
  } else {
    generationQueue = createGenerationQueue({ gemini });
    logger.info('REDIS_URL not set: using in-process generation queue and memory cache');
  }

  const app = createApp({ gemini, generationQueue });
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'CodeNexus API listening'));

  const shutdown = (signal) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      if (generationQueue.close) await generationQueue.close();
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'failed to start');
  process.exit(1);
});
