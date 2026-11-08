'use strict';

/**
 * Integration tests need a real MongoDB. Use TEST_MONGODB_URI when it is set (CI service container,
 * local Docker). Otherwise try an in-memory server. If neither works the integration suites are
 * skipped and say so, instead of failing for an environment reason.
 */
module.exports = async () => {
  if (process.env.TEST_MONGODB_URI) return;
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    globalThis.__MONGO_SERVER__ = server;
    process.env.TEST_MONGODB_URI = server.getUri();
  } catch (err) {
    process.env.DB_UNAVAILABLE = '1';
    // eslint-disable-next-line no-console
    console.warn(
      '\n[integration] No MongoDB available (set TEST_MONGODB_URI, e.g. mongodb://127.0.0.1:27017). ' +
        `Integration suites will be skipped. Reason: ${String(err.message).split('\n')[0]}\n`,
    );
  }
};
