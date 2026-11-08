'use strict';

const Question = require('../models/Question');
const TestAttempt = require('../models/TestAttempt');
const Skill = require('../models/Skill');
const User = require('../models/User');
const { TAXONOMY, subtopicKeys, subtopicLabel, isValidSubtopic } = require('../config/taxonomy');
const { DEFAULT_LEVEL, updateLevel, difficultyForLevel } = require('./skill');
const { selectQuestions } = require('./selector');
const { loadLevels } = require('./skillService');
const { updateStreak } = require('../utils/dates');
const { conflict, notFound, badRequest } = require('../utils/errors');

const TIME_GRACE_MS = 30 * 1000;

/** Spread `count` questions over the subtopics; the weakest ones get the remainder. */
function distribute(count, keys, levels) {
  const ordered = [...keys].sort(
    (a, b) => (levels[a] ?? DEFAULT_LEVEL) - (levels[b] ?? DEFAULT_LEVEL),
  );
  const chosen = ordered.slice(0, Math.min(count, ordered.length));
  const base = Math.floor(count / chosen.length);
  const extra = count % chosen.length;
  return chosen.map((key, i) => ({ key, n: base + (i < extra ? 1 : 0) }));
}

async function seenMap(userId, questionIds) {
  if (!questionIds.length) return new Map();
  const rows = await TestAttempt.aggregate([
    { $match: { user: userId, 'questions.question': { $in: questionIds } } },
    { $unwind: '$questions' },
    { $match: { 'questions.question': { $in: questionIds } } },
    { $group: { _id: '$questions.question', lastSeen: { $max: '$startedAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.lastSeen]));
}

function clientAttempt(attempt, questionDocs, resumed = false) {
  const byId = new Map(questionDocs.map((q) => [String(q._id), q]));
  return {
    id: String(attempt._id),
    subject: attempt.subject,
    focusSubtopic: attempt.focusSubtopic || null,
    status: attempt.status,
    startedAt: attempt.startedAt,
    timeLimitSeconds: attempt.timeLimitSeconds,
    resumed,
    questions: attempt.questions
      .map((q) => byId.get(String(q.question)))
      .filter(Boolean)
      .map((q) => q.toClient()),
  };
}

/**
 * Start (or resume) a test. With `subtopic` the test is a short quiz on that one subtopic, as set by a
 * roadmap quiz task; without it the test spans the whole subject. The two kinds resume independently.
 */
async function startTest({ user, subject, subtopic = null, count, timeLimitMinutes, generationQueue }) {
  if (!TAXONOMY[subject]) throw badRequest('Unknown subject', 'bad_subject');
  if (subtopic && !isValidSubtopic(subject, subtopic)) throw badRequest('Unknown subtopic for this subject', 'bad_subtopic');

  const open = await TestAttempt.findOne({ user: user._id, subject, focusSubtopic: subtopic || null, status: 'in_progress' }).sort({ startedAt: -1 });
  if (open) {
    const expired = open.timeLimitSeconds && Date.now() > open.startedAt.getTime() + open.timeLimitSeconds * 1000 + TIME_GRACE_MS;
    if (!expired) {
      const docs = await Question.find({ _id: { $in: open.questions.map((q) => q.question) } });
      return clientAttempt(open, docs, true);
    }
  }

  const levels = (await loadLevels(user._id))[subject] || {};
  const plan = subtopic ? [{ key: subtopic, n: count }] : distribute(count, subtopicKeys(subject), levels);

  const selected = [];
  let fallbackUsed = 0;
  for (const { key, n } of plan) {
    const level = levels[key] ?? DEFAULT_LEVEL;
    const target = difficultyForLevel(level);
    const candidates = await Question.find({ subject, subtopic: key, status: 'approved' }).select('_id difficulty').lean();
    const seen = await seenMap(user._id, candidates.map((c) => c._id));
    const pick = selectQuestions({
      candidates: candidates.map((c) => ({ id: String(c._id), difficulty: c.difficulty })),
      seen,
      targetDifficulty: target,
      count: n,
    });
    if (pick.needsGeneration && generationQueue) {
      // Fire and forget: generated questions arrive as pending and wait for admin approval.
      generationQueue.request({ subject, subtopic: key, difficulty: target, count: Math.max(5, pick.generationCount) });
    }
    fallbackUsed += pick.fallbackUsed;
    for (const q of pick.selected) selected.push({ id: q.id, subtopic: key, difficulty: q.difficulty });
  }

  if (!selected.length) throw conflict('No approved questions are available for this subject yet', 'no_questions');

  // Shuffle so subtopics are interleaved.
  for (let i = selected.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  const attempt = await TestAttempt.create({
    user: user._id,
    subject,
    focusSubtopic: subtopic || null,
    questions: selected.map((s) => ({ question: s.id, subtopic: s.subtopic, difficulty: s.difficulty })),
    timeLimitSeconds: timeLimitMinutes ? Math.round(timeLimitMinutes * 60) : null,
    fallbackUsed,
  });
  const docs = await Question.find({ _id: { $in: selected.map((s) => s.id) } });
  return clientAttempt(attempt, docs);
}

/**
 * Score a submission. Pure: takes the attempt's questions, the answer key and the student's
 * answers, returns per-question marks and per-subtopic scores.
 */
function scoreAttempt({ attemptQuestions, answerKey, answers }) {
  const chosen = new Map();
  for (const a of answers) {
    if (!chosen.has(a.questionId)) chosen.set(a.questionId, a.selectedIndex);
  }
  const perQuestion = attemptQuestions.map((q) => {
    const id = String(q.question);
    const selectedIndex = chosen.has(id) ? chosen.get(id) : null;
    return {
      question: q.question,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      selectedIndex,
      correct: selectedIndex !== null && selectedIndex === answerKey.get(id),
    };
  });

  const bySub = {};
  for (const q of perQuestion) {
    const s = (bySub[q.subtopic] = bySub[q.subtopic] || { correct: 0, total: 0 });
    s.total += 1;
    if (q.correct) s.correct += 1;
  }
  const correctCount = perQuestion.filter((q) => q.correct).length;
  return {
    perQuestion,
    bySubtopic: bySub,
    correctCount,
    score: perQuestion.length ? correctCount / perQuestion.length : 0,
  };
}

/** Question-by-question review. A question an admin has since erased is skipped, not a crash. */
function reviewRows(attemptQuestions, byId) {
  return attemptQuestions
    .map((q) => {
      const d = byId.get(String(q.question));
      if (!d) return null;
      return {
        questionId: String(q.question),
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        text: d.text,
        options: d.options,
        selectedIndex: q.selectedIndex,
        correctIndex: d.correctIndex,
        correct: q.correct,
        explanation: d.explanation,
      };
    })
    .filter(Boolean);
}

async function submitTest({ user, attemptId, answers, now = new Date() }) {
  const attempt = await TestAttempt.findOne({ _id: attemptId, user: user._id });
  if (!attempt) throw notFound('Test not found');
  if (attempt.status === 'submitted') throw conflict('This test was already submitted', 'already_submitted');

  const questionIds = attempt.questions.map((q) => q.question);
  const docs = await Question.find({ _id: { $in: questionIds } });
  const answerKey = new Map(docs.map((d) => [String(d._id), d.correctIndex]));

  const known = new Set(questionIds.map(String));
  const stray = answers.find((a) => !known.has(a.questionId));
  if (stray) throw badRequest('Answer refers to a question that is not part of this test', 'bad_question');

  const scored = scoreAttempt({ attemptQuestions: attempt.questions, answerKey, answers });
  const levels = (await loadLevels(user._id))[attempt.subject] || {};
  const subtopicScores = Object.entries(scored.bySubtopic).map(([subtopic, s]) => {
    const before = levels[subtopic] ?? DEFAULT_LEVEL;
    const score = s.correct / s.total;
    return { subtopic, correct: s.correct, total: s.total, score, levelBefore: before, levelAfter: updateLevel(before, score) };
  });

  const timedOut = Boolean(
    attempt.timeLimitSeconds && now.getTime() > attempt.startedAt.getTime() + attempt.timeLimitSeconds * 1000 + TIME_GRACE_MS,
  );

  // Claim the attempt atomically so a double submit cannot count twice.
  const claimed = await TestAttempt.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    {
      $set: {
        status: 'submitted',
        submittedAt: now,
        timedOut,
        score: scored.score,
        correctCount: scored.correctCount,
        questions: scored.perQuestion,
        subtopicScores,
      },
    },
    { new: true },
  );
  if (!claimed) throw conflict('This test was already submitted', 'already_submitted');

  await Question.bulkWrite(
    scored.perQuestion.map((q) => ({
      updateOne: {
        filter: { _id: q.question },
        update: { $inc: { timesAsked: 1, timesCorrect: q.correct ? 1 : 0 } },
      },
    })),
  );

  await Skill.bulkWrite(
    subtopicScores.map((s) => ({
      updateOne: {
        filter: { user: user._id, subject: attempt.subject, subtopic: s.subtopic },
        update: { $set: { level: s.levelAfter, lastScore: s.score }, $inc: { attempts: 1 } },
        upsert: true,
      },
    })),
  );

  const fresh = await User.findById(user._id);
  fresh.streak = updateStreak(fresh.streak, now, fresh.timezone);
  await fresh.save();

  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return {
    id: String(claimed._id),
    subject: claimed.subject,
    focusSubtopic: claimed.focusSubtopic || null,
    score: claimed.score,
    correctCount: claimed.correctCount,
    total: claimed.questions.length,
    timedOut,
    submittedAt: claimed.submittedAt,
    subtopics: subtopicScores.map((s) => ({ ...s, label: subtopicLabel(attempt.subject, s.subtopic) })),
    review: reviewRows(claimed.questions, byId),
    streak: fresh.streak.current,
  };
}

/** A submitted test, in the same shape as the submit response. */
async function getResult({ user, attemptId }) {
  const attempt = await TestAttempt.findOne({ _id: attemptId, user: user._id });
  if (!attempt) throw notFound('Test not found');
  if (attempt.status !== 'submitted') {
    const docs = await Question.find({ _id: { $in: attempt.questions.map((q) => q.question) } });
    return { ...clientAttempt(attempt, docs) };
  }
  const docs = await Question.find({ _id: { $in: attempt.questions.map((q) => q.question) } });
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return {
    id: String(attempt._id),
    subject: attempt.subject,
    focusSubtopic: attempt.focusSubtopic || null,
    status: attempt.status,
    score: attempt.score,
    correctCount: attempt.correctCount,
    total: attempt.questions.length,
    timedOut: attempt.timedOut,
    submittedAt: attempt.submittedAt,
    subtopics: attempt.subtopicScores.map((s) => ({ ...s.toObject(), label: subtopicLabel(attempt.subject, s.subtopic) })),
    review: reviewRows(attempt.questions, byId),
  };
}

module.exports = { distribute, scoreAttempt, startTest, submitTest, getResult };
