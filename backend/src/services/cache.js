'use strict';

/**
 * Small JSON cache. Uses Redis when one is attached (attachRedis), otherwise a per-process Map with
 * TTL, so the app behaves the same with or without Redis. Cache failures never fail a request.
 */
const memory = new Map();
let redis = null;

function attachRedis(client) {
  redis = client;
}

function detachRedis() {
  redis = null;
}

async function get(key) {
  try {
    if (redis) {
      const raw = await redis.get(`cn:${key}`);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (err) {
    return null;
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

async function set(key, value, ttlSeconds = 60) {
  try {
    if (redis) {
      await redis.set(`cn:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    }
  } catch (err) {
    return;
  }
  memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

async function del(key) {
  memory.delete(key);
  try {
    if (redis) await redis.del(`cn:${key}`);
  } catch (err) {
    // ignore
  }
}

/** Read-through helper: return the cached value or compute, store and return it. */
async function remember(key, ttlSeconds, compute) {
  const cached = await get(key);
  if (cached !== null) return cached;
  const value = await compute();
  await set(key, value, ttlSeconds);
  return value;
}

function clearMemory() {
  memory.clear();
}

module.exports = { attachRedis, detachRedis, get, set, del, remember, clearMemory };
