'use strict';

const { createGeminiClient, GeminiError, parseJsonText } = require('../../src/services/gemini');

const ok = (obj) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
});
const status = (code) => ({ ok: false, status: code, json: async () => ({}) });

const make = (fetchImpl, extra = {}) =>
  createGeminiClient({ apiKey: 'k', model: 'm', fetchImpl, backoffMs: 1, timeoutMs: 200, ...extra });

describe('gemini client', () => {
  test('is disabled without a key or model', () => {
    expect(createGeminiClient({ apiKey: '', model: 'm', fetchImpl: jest.fn() }).enabled).toBe(false);
    expect(createGeminiClient({ apiKey: 'k', model: '', fetchImpl: jest.fn() }).enabled).toBe(false);
  });

  test('calling a disabled client throws a GeminiError', async () => {
    const client = createGeminiClient({ apiKey: '', model: '', fetchImpl: jest.fn() });
    await expect(client.generateJson('hi')).rejects.toBeInstanceOf(GeminiError);
  });

  test('sends the key in a header, never in the URL, and returns parsed JSON', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok({ a: 1 }));
    const out = await make(fetchImpl).generateJson('hello');
    expect(out).toEqual({ a: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/models/m:generateContent');
    expect(url).not.toContain('key=');
    expect(init.headers['x-goog-api-key']).toBe('k');
    expect(JSON.parse(init.body).generationConfig.responseMimeType).toBe('application/json');
  });

  test('retries a transient 503 once, then succeeds', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok({ done: true }));
    await expect(make(fetchImpl).generateJson('x')).resolves.toEqual({ done: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('gives up after the retry budget', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(status(500));
    await expect(make(fetchImpl).generateJson('x')).rejects.toBeInstanceOf(GeminiError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('does not retry a client error such as 400', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(status(400));
    await expect(make(fetchImpl).generateJson('x')).rejects.toBeInstanceOf(GeminiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('a hung request is cut off by the timeout', async () => {
    const fetchImpl = jest.fn((url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
      }),
    );
    const client = make(fetchImpl, { timeoutMs: 30, retries: 0 });
    await expect(client.generateJson('x')).rejects.toThrow(/timed out/);
  });

  test('malformed model output is an error, not a crash', async () => {
    const bad = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json {' }] } }] }) };
    await expect(make(jest.fn().mockResolvedValue(bad), { retries: 0 }).generateJson('x')).rejects.toThrow(/malformed/);
  });
});

describe('parseJsonText', () => {
  test('strips markdown code fences', () => {
    expect(parseJsonText('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
});
