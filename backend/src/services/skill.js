'use strict';

const LEARNING_RATE = 0.3;
const DEFAULT_LEVEL = 0.5;
const MASTERY_THRESHOLD = 0.8;
const EASY_BELOW = 0.4;
const MEDIUM_BELOW = 0.7;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** level += 0.3 * (score - level), kept inside [0, 1]. */
function updateLevel(level, score, rate = LEARNING_RATE) {
  const current = Number.isFinite(level) ? clamp01(level) : DEFAULT_LEVEL;
  const s = clamp01(score);
  return clamp01(current + rate * (s - current));
}

/** low -> easy, mid -> medium, high -> hard. */
function difficultyForLevel(level) {
  const l = Number.isFinite(level) ? level : DEFAULT_LEVEL;
  if (l < EASY_BELOW) return 'easy';
  if (l < MEDIUM_BELOW) return 'medium';
  return 'hard';
}

/** Subject score = mean level across all of the subject's subtopics (untested ones count as DEFAULT_LEVEL). */
function subjectScore(levelsByKey, subtopicKeys) {
  if (!subtopicKeys.length) return DEFAULT_LEVEL;
  const total = subtopicKeys.reduce((sum, key) => {
    const v = levelsByKey[key];
    return sum + (Number.isFinite(v) ? v : DEFAULT_LEVEL);
  }, 0);
  return total / subtopicKeys.length;
}

const isMastered = (level) => level >= MASTERY_THRESHOLD;

module.exports = {
  LEARNING_RATE,
  DEFAULT_LEVEL,
  MASTERY_THRESHOLD,
  clamp01,
  updateLevel,
  difficultyForLevel,
  subjectScore,
  isMastered,
};
