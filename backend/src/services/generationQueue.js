'use strict';

const logger = require('../utils/logger');
const { generateQuestions } = require('./questionGenerator');
const { mongoQuestionStore } = require('./questionStore');

/**
 * Background question generation. Requests are de-duplicated per subject/subtopic/difficulty so a
 * burst of students running out of questions triggers one Gemini job, not dozens. Generated
 * questions are saved as pending and never served until an admin approves them.
 *
 * Phase 5 swaps this in-process queue for BullMQ; the interface (request) stays the same.
 */
function createGenerationQueue({ gemini, store = mongoQuestionStore } = {}) {
  const inflight = new Map();

  function request({ subject, subtopic, difficulty, count = 5 }) {
    if (!gemini || !gemini.enabled) return Promise.resolve({ skipped: 'gemini_not_configured' });
    const key = `${subject}:${subtopic}:${difficulty}`;
    if (inflight.has(key)) return inflight.get(key);

    const job = generateQuestions({ subject, subtopic, difficulty, count, gemini, store })
      .then((result) => {
        logger.info({ key, created: result.created.length, rejected: result.rejected, skipped: result.skipped }, 'question generation finished');
        return result;
      })
      .catch((err) => {
        logger.error({ err, key }, 'question generation failed');
        return { skipped: 'error' };
      })
      .finally(() => inflight.delete(key));

    inflight.set(key, job);
    return job;
  }

  return { request, pending: () => inflight.size };
}

module.exports = { createGenerationQueue };
