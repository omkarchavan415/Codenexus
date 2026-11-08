'use strict';

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../utils/logger');
const { generateQuestions } = require('./questionGenerator');
const { mongoQuestionStore } = require('./questionStore');

const QUEUE_NAME = 'question-generation';

/** One job per subject/subtopic/difficulty. The id is the idempotency key: BullMQ ignores an add whose id is still queued or running. */
function jobKey({ subject, subtopic, difficulty }) {
  return `${subject}__${subtopic}__${difficulty}`;
}

/**
 * Generation queue backed by Redis + BullMQ. Same interface as the in-process queue:
 * request({subject, subtopic, difficulty, count}) resolves immediately with { queued } (the work
 * happens in the worker), and a burst of identical requests collapses into one job.
 * Failed jobs retry with exponential backoff. The questionGenerator also rejects duplicates by
 * hash, so a retried or replayed job can never create the same question twice.
 */
function createBullGenerationQueue({ gemini, redisUrl, store = mongoQuestionStore, concurrency = 1 } = {}) {
  // BullMQ requires maxRetriesPerRequest: null on worker connections.
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  connection.on('error', (err) => logger.warn({ err: err.message }, 'redis connection error'));

  const queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { subject, subtopic, difficulty, count } = job.data;
      const result = await generateQuestions({ subject, subtopic, difficulty, count, gemini, store });
      logger.info({ job: job.id, created: result.created.length, rejected: result.rejected, skipped: result.skipped }, 'question generation finished');
      return { created: result.created.length, rejected: result.rejected, skipped: result.skipped };
    },
    { connection: connection.duplicate({ maxRetriesPerRequest: null }), concurrency },
  );
  worker.on('failed', (job, err) => logger.error({ err: err.message, job: job && job.id }, 'question generation job failed'));
  worker.on('error', (err) => logger.warn({ err: err.message }, 'generation worker error'));

  async function request({ subject, subtopic, difficulty, count = 5 }) {
    if (!gemini || !gemini.enabled) return { skipped: 'gemini_not_configured' };
    try {
      const id = jobKey({ subject, subtopic, difficulty });
      await queue.add('generate', { subject, subtopic, difficulty, count }, { jobId: id });
      return { queued: id };
    } catch (err) {
      logger.error({ err: err.message }, 'could not queue generation job');
      return { skipped: 'error' };
    }
  }

  async function pending() {
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
    return counts.waiting + counts.active + counts.delayed;
  }

  async function close() {
    await worker.close();
    await queue.close();
    connection.disconnect();
  }

  return { request, pending, close, connection };
}

module.exports = { createBullGenerationQueue, jobKey, QUEUE_NAME };
