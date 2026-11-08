'use strict';

const TestAttempt = require('../models/TestAttempt');
const { subtopicLabel } = require('../config/taxonomy');

/**
 * Score history per subject and per subtopic, plus improvement since the first test.
 * attempts: submitted attempts, oldest first.
 */
function buildProgress(attempts) {
  const subjects = {};
  for (const a of attempts) {
    const subject = (subjects[a.subject] = subjects[a.subject] || { history: [], subtopics: {} });
    subject.history.push({ attemptId: String(a._id), date: a.submittedAt, score: a.score });
    for (const s of a.subtopicScores || []) {
      const list = (subject.subtopics[s.subtopic] = subject.subtopics[s.subtopic] || { label: subtopicLabel(a.subject, s.subtopic), history: [] });
      list.history.push({ date: a.submittedAt, score: s.score, level: s.levelAfter });
    }
  }

  const out = {};
  for (const [name, subject] of Object.entries(subjects)) {
    const first = subject.history[0].score;
    const latest = subject.history[subject.history.length - 1].score;
    out[name] = {
      tests: subject.history.length,
      firstScore: first,
      latestScore: latest,
      improvement: latest - first,
      history: subject.history,
      subtopics: Object.entries(subject.subtopics).map(([key, v]) => ({
        subtopic: key,
        label: v.label,
        firstScore: v.history[0].score,
        latestScore: v.history[v.history.length - 1].score,
        improvement: v.history[v.history.length - 1].score - v.history[0].score,
        level: v.history[v.history.length - 1].level,
        history: v.history,
      })),
    };
  }
  return out;
}

async function loadProgress(userId) {
  const attempts = await TestAttempt.find({ user: userId, status: 'submitted' }).sort({ submittedAt: 1 }).lean();
  return { totalTests: attempts.length, subjects: buildProgress(attempts) };
}

module.exports = { buildProgress, loadProgress };
