'use strict';

const { DIFFICULTIES } = require('../config/taxonomy');

const rank = (d) => DIFFICULTIES.indexOf(d);

/**
 * Pure question selection for one subtopic.
 *
 * Order of preference:
 *   1. unseen questions, nearest difficulty to the target first
 *   2. (caller reacts to needsGeneration by asking Gemini for more, saved as pending)
 *   3. oldest-seen questions as the last fallback, nearest difficulty breaking ties
 *
 * candidates: [{ id, difficulty }]   approved questions only
 * seen:       Map<id, Date|number>   when the student last saw each question
 */
function selectQuestions({ candidates, seen, targetDifficulty, count, rng = Math.random }) {
  const target = rank(targetDifficulty);
  const seenMap = seen instanceof Map ? seen : new Map();
  const distance = (q) => Math.abs(rank(q.difficulty) - target);
  const withJitter = candidates.map((q) => ({ q, jitter: rng() }));

  const unseen = withJitter
    .filter(({ q }) => !seenMap.has(String(q.id)))
    .sort((a, b) => distance(a.q) - distance(b.q) || a.jitter - b.jitter)
    .map(({ q }) => q);

  const selected = unseen.slice(0, count);
  const unseenShortfall = Math.max(0, count - unseen.length);

  let fallbackUsed = 0;
  if (selected.length < count) {
    const chosen = new Set(selected.map((q) => String(q.id)));
    const seenSorted = withJitter
      .filter(({ q }) => seenMap.has(String(q.id)) && !chosen.has(String(q.id)))
      .sort((a, b) => {
        const ta = new Date(seenMap.get(String(a.q.id))).getTime();
        const tb = new Date(seenMap.get(String(b.q.id))).getTime();
        return ta - tb || distance(a.q) - distance(b.q) || a.jitter - b.jitter;
      })
      .map(({ q }) => q);
    const extra = seenSorted.slice(0, count - selected.length);
    fallbackUsed = extra.length;
    selected.push(...extra);
  }

  return {
    selected,
    needsGeneration: unseenShortfall > 0,
    generationCount: unseenShortfall,
    fallbackUsed,
    short: Math.max(0, count - selected.length),
  };
}

module.exports = { selectQuestions };
