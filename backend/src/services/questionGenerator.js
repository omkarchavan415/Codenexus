'use strict';

const crypto = require('crypto');
const { z } = require('zod');
const { TAXONOMY, subtopicLabel, isValidSubtopic } = require('../config/taxonomy');

/** Normalised fingerprint used to reject duplicate questions. */
function questionHash(text) {
  const normalised = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return crypto.createHash('sha256').update(normalised).digest('hex');
}

const generatedQuestionSchema = z
  .object({
    text: z.string().trim().min(15).max(1500),
    options: z
      .array(z.string().trim().min(1).max(500))
      .length(4)
      .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === 4, 'options must be distinct'),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(10).max(2000),
  })
  .strict();

const responseSchema = z.object({ questions: z.array(z.unknown()).min(1) });

function generationPrompt({ subject, subtopic, difficulty, count }) {
  return [
    `You write multiple-choice questions for campus placement preparation.`,
    `Subject: ${TAXONOMY[subject].label}. Subtopic: ${subtopicLabel(subject, subtopic)}. Difficulty: ${difficulty}.`,
    `Write exactly ${count} distinct questions. Each must have exactly one correct option, four distinct options, and a short explanation of why the answer is correct.`,
    `Return only JSON in this exact shape, with no extra keys:`,
    `{"questions":[{"text":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}`,
    `correctIndex is the 0-based index of the correct option. Vary the position of the correct option.`,
  ].join('\n');
}

function verificationPrompt(q) {
  return [
    `Answer this multiple-choice question independently. Work out the correct option yourself.`,
    `Question: ${q.text}`,
    ...q.options.map((o, i) => `${i}: ${o}`),
    `Return only JSON: {"answerIndex": <0-based index of the single correct option>}`,
  ].join('\n');
}

/**
 * Generate questions with Gemini and queue the good ones for admin review.
 *
 *  1. strict format validation (bad items are dropped)
 *  2. duplicate rejection, both against the bank and inside the batch
 *  3. a second, independent call checks that the model picks the same answer
 *  4. survivors are saved as status "pending"; an admin approves them before students see them
 *
 * store: { findExistingHashes(hashes) -> Set<string>, insertPending(docs) -> saved docs }
 */
async function generateQuestions({ subject, subtopic, difficulty, count, gemini, store }) {
  if (!TAXONOMY[subject] || !isValidSubtopic(subject, subtopic)) {
    throw new Error('Unknown subject or subtopic');
  }
  const rejected = { invalidFormat: 0, duplicate: 0, verificationFailed: 0 };
  const result = { requested: count, created: [], rejected, skipped: null };

  if (!gemini || !gemini.enabled) {
    result.skipped = 'gemini_not_configured';
    return result;
  }

  let raw;
  try {
    raw = await gemini.generateJson(generationPrompt({ subject, subtopic, difficulty, count }), { temperature: 0.7 });
  } catch (err) {
    result.skipped = 'gemini_unavailable';
    return result;
  }

  const envelope = responseSchema.safeParse(raw);
  if (!envelope.success) {
    result.skipped = 'invalid_response';
    return result;
  }

  const valid = [];
  for (const item of envelope.data.questions) {
    const parsed = generatedQuestionSchema.safeParse(item);
    if (parsed.success) valid.push(parsed.data);
    else rejected.invalidFormat += 1;
  }

  const hashes = valid.map((q) => questionHash(q.text));
  const existing = await store.findExistingHashes(hashes);
  const seenInBatch = new Set();
  const fresh = [];
  valid.forEach((q, i) => {
    const hash = hashes[i];
    if (existing.has(hash) || seenInBatch.has(hash)) {
      rejected.duplicate += 1;
      return;
    }
    seenInBatch.add(hash);
    fresh.push({ q, hash });
  });

  const verified = [];
  for (const entry of fresh) {
    try {
      const answer = await gemini.generateJson(verificationPrompt(entry.q), { temperature: 0 });
      if (answer && answer.answerIndex === entry.q.correctIndex) verified.push(entry);
      else rejected.verificationFailed += 1;
    } catch (err) {
      // An answer we could not double-check is not trusted.
      rejected.verificationFailed += 1;
    }
  }

  const docs = verified.slice(0, count).map(({ q, hash }) => ({
    subject,
    subtopic,
    difficulty,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    hash,
    status: 'pending',
    source: 'gemini',
    verified: true,
  }));

  result.created = docs.length ? await store.insertPending(docs) : [];
  return result;
}

module.exports = { questionHash, generateQuestions, generatedQuestionSchema };
