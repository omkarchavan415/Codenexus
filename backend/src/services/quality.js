'use strict';

const MIN_ASKED_DEFAULT = 10;

/**
 * Judge a question from how students actually answered it. Needs enough attempts to mean anything.
 *
 * Returns { asked, correct, accuracy, flag } where flag is null for a healthy question, otherwise:
 *   possible_wrong_key     almost nobody gets it right: the stored answer may be wrong
 *   too_easy               nearly everybody gets it right: it does not discriminate
 *   harder_than_labelled   an "easy" question most students miss
 *   easier_than_labelled   a "hard" question most students get right
 */
function questionQuality({ timesAsked = 0, timesCorrect = 0, difficulty }, { minAsked = MIN_ASKED_DEFAULT } = {}) {
  const asked = Math.max(0, timesAsked);
  const correct = Math.min(asked, Math.max(0, timesCorrect));
  const accuracy = asked ? correct / asked : null;
  const base = { asked, correct, accuracy, flag: null, enoughData: asked >= minAsked };
  if (asked < minAsked) return base;

  if (accuracy < 0.15) return { ...base, flag: 'possible_wrong_key' };
  if (accuracy > 0.97) return { ...base, flag: 'too_easy' };
  if (difficulty === 'easy' && accuracy < 0.4) return { ...base, flag: 'harder_than_labelled' };
  if (difficulty === 'hard' && accuracy > 0.85) return { ...base, flag: 'easier_than_labelled' };
  return base;
}

module.exports = { questionQuality, MIN_ASKED_DEFAULT };
