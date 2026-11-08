'use strict';

const cache = require('../../src/services/cache');
const { jobKey } = require('../../src/services/bullQueue');

afterEach(() => {
  cache.detachRedis();
  cache.clearMemory();
  jest.useRealTimers();
});

describe('cache (memory fallback)', () => {
  test('remember computes once then serves the cached value', async () => {
    const compute = jest.fn().mockResolvedValue({ n: 1 });
    expect(await cache.remember('k', 60, compute)).toEqual({ n: 1 });
    expect(await cache.remember('k', 60, compute)).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('entries expire after their ttl', async () => {
    jest.useFakeTimers();
    await cache.set('k', 'v', 1);
    expect(await cache.get('k')).toBe('v');
    jest.advanceTimersByTime(1500);
    expect(await cache.get('k')).toBeNull();
  });

  test('del removes an entry', async () => {
    await cache.set('k', 1, 60);
    await cache.del('k');
    expect(await cache.get('k')).toBeNull();
  });
});

describe('cache (redis)', () => {
  test('uses the attached client and prefixes keys', async () => {
    const store = new Map();
    cache.attachRedis({
      get: async (k) => store.get(k) || null,
      set: async (k, v) => store.set(k, v),
      del: async (k) => store.delete(k),
    });
    await cache.set('a', { x: 1 }, 10);
    expect([...store.keys()]).toEqual(['cn:a']);
    expect(await cache.get('a')).toEqual({ x: 1 });
  });

  test('a failing redis never throws', async () => {
    cache.attachRedis({
      get: async () => { throw new Error('down'); },
      set: async () => { throw new Error('down'); },
      del: async () => { throw new Error('down'); },
    });
    await expect(cache.get('a')).resolves.toBeNull();
    await expect(cache.set('a', 1)).resolves.toBeUndefined();
    await expect(cache.del('a')).resolves.toBeUndefined();
  });
});

describe('generation job key', () => {
  test('is identical for the same subject/subtopic/difficulty so repeats collapse into one job', () => {
    const a = jobKey({ subject: 'DSA', subtopic: 'trees', difficulty: 'easy', count: 5 });
    const b = jobKey({ subject: 'DSA', subtopic: 'trees', difficulty: 'easy', count: 9 });
    expect(a).toBe(b);
    expect(a).not.toBe(jobKey({ subject: 'DSA', subtopic: 'trees', difficulty: 'hard' }));
  });
});
