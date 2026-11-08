'use strict';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

class GeminiError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.retryable = Boolean(retryable);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseJsonText(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/**
 * Small Gemini REST client. Every call has a timeout, transient failures (429, 5xx, network,
 * timeout) are retried with backoff, and anything else surfaces as a GeminiError so callers
 * can fall back instead of hanging.
 */
function createGeminiClient({
  apiKey,
  model,
  timeoutMs = 20000,
  retries = 1,
  backoffMs = 500,
  fetchImpl = globalThis.fetch,
} = {}) {
  const enabled = Boolean(apiKey && model && fetchImpl);

  async function callOnce(prompt, temperature) {
    let response;
    try {
      response = await fetchImpl(`${BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new GeminiError(timedOut ? 'Gemini request timed out' : `Gemini request failed: ${err.message}`, {
        retryable: true,
      });
    }

    if (!response.ok) {
      throw new GeminiError(`Gemini responded with HTTP ${response.status}`, {
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    let body;
    try {
      body = await response.json();
    } catch (err) {
      throw new GeminiError('Gemini returned a non-JSON response', { retryable: true });
    }
    const text =
      body && body.candidates && body.candidates[0] && body.candidates[0].content &&
      body.candidates[0].content.parts && body.candidates[0].content.parts[0] &&
      body.candidates[0].content.parts[0].text;
    if (!text) throw new GeminiError('Gemini returned no content', { retryable: true });

    try {
      return parseJsonText(text);
    } catch (err) {
      throw new GeminiError('Gemini returned malformed JSON', { retryable: true });
    }
  }

  /** Ask for a JSON answer and return it parsed. */
  async function generateJson(prompt, { temperature = 0.4 } = {}) {
    if (!enabled) throw new GeminiError('Gemini is not configured', { retryable: false });
    let attempt = 0;
    for (;;) {
      try {
        return await callOnce(prompt, temperature);
      } catch (err) {
        if (!(err instanceof GeminiError) || !err.retryable || attempt >= retries) throw err;
        attempt += 1;
        await sleep(backoffMs * attempt);
      }
    }
  }

  return { enabled, generateJson };
}

module.exports = { createGeminiClient, GeminiError, parseJsonText };
