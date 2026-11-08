'use strict';

const { isMastered, DEFAULT_LEVEL } = require('./skill');

const WEIGHT_VALUES = { high: 3, medium: 2, low: 1 };

const weightValue = (weight) => WEIGHT_VALUES[weight] || 0;

/** Gap priority = requirement weight (high 3, medium 2, low 1) x (1 - score). */
function gapPriority(weight, score) {
  return weightValue(weight) * (1 - score);
}

function classify(priority, score) {
  if (isMastered(score)) return 'mastered';
  if (priority >= 1.5) return 'high';
  if (priority >= 0.75) return 'medium';
  return 'low';
}

/**
 * requirements: [{ subject, weight }]   from the company profile
 * subjectScores: { [subject]: 0..1 }
 * Subjects missing from the profile are not part of the target and are left out.
 * Returns gaps sorted by priority, biggest first.
 */
function analyzeGaps({ requirements, subjectScores }) {
  return requirements
    .filter((r) => weightValue(r.weight) > 0)
    .map((r) => {
      const score = Number.isFinite(subjectScores[r.subject]) ? subjectScores[r.subject] : DEFAULT_LEVEL;
      const priority = gapPriority(r.weight, score);
      return {
        subject: r.subject,
        weight: r.weight,
        weightValue: weightValue(r.weight),
        score,
        priority,
        severity: classify(priority, score),
      };
    })
    .sort((a, b) => b.priority - a.priority || a.subject.localeCompare(b.subject));
}

/**
 * Same formula at subtopic granularity, used to split the remaining days.
 * subtopicLevels: { [subject]: { [subtopic]: level } }
 */
function subtopicPriorities({ gaps, subtopicKeysBySubject, subtopicLevels }) {
  const out = [];
  for (const gap of gaps) {
    for (const key of subtopicKeysBySubject[gap.subject] || []) {
      const level = Number.isFinite((subtopicLevels[gap.subject] || {})[key])
        ? subtopicLevels[gap.subject][key]
        : DEFAULT_LEVEL;
      out.push({
        subject: gap.subject,
        subtopic: key,
        level,
        weight: gap.weight,
        priority: gapPriority(gap.weight, level),
      });
    }
  }
  return out.sort((a, b) => b.priority - a.priority);
}

module.exports = { WEIGHT_VALUES, weightValue, gapPriority, analyzeGaps, subtopicPriorities };
