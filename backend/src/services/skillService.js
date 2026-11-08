'use strict';

const Skill = require('../models/Skill');
const { TAXONOMY, subtopicKeys } = require('../config/taxonomy');
const { subjectScore } = require('./skill');

/** { [subject]: { [subtopic]: level } } for the subtopics the student has been tested on. */
async function loadLevels(userId) {
  const rows = await Skill.find({ user: userId }).lean();
  const levels = {};
  for (const row of rows) {
    (levels[row.subject] = levels[row.subject] || {})[row.subtopic] = row.level;
  }
  return levels;
}

function subjectScores(levels) {
  const out = {};
  for (const subject of Object.keys(TAXONOMY)) {
    out[subject] = subjectScore(levels[subject] || {}, subtopicKeys(subject));
  }
  return out;
}

module.exports = { loadLevels, subjectScores };
