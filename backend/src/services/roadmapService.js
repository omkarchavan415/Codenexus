'use strict';

const Roadmap = require('../models/Roadmap');
const Company = require('../models/Company');
const Problem = require('../models/Problem');
const ProblemProgress = require('../models/ProblemProgress');
const StudyItem = require('../models/StudyItem');
const StudyProgress = require('../models/StudyProgress');
const TestAttempt = require('../models/TestAttempt');
const { TAXONOMY, subtopicKeys, subtopicLabel } = require('../config/taxonomy');
const { loadLevels, subjectScores } = require('./skillService');
const { analyzeGaps, subtopicPriorities } = require('./gap');
const { buildPlan } = require('./planner');
const { computeDailyPlan, progressPercent, trackedIds, quizKey } = require('./dailyPlan');
const { dayKey, dayDiff } = require('../utils/dates');
const { conflict, notFound } = require('../utils/errors');

async function solvedSet(userId) {
  const rows = await ProblemProgress.find({ user: userId }).select('problem').lean();
  return new Set(rows.map((r) => String(r.problem)));
}

async function doneItemSet(userId) {
  const rows = await StudyProgress.find({ user: userId }).select('item').lean();
  return new Set(rows.map((r) => String(r.item)));
}

const OBJECT_ID = /^[0-9a-f]{24}$/;

/**
 * Everything the student has finished that this roadmap tracks: problem ids, study item ids and
 * quiz keys. A quiz counts once a quiz on that subtopic was submitted after this roadmap was made,
 * so a rescheduled plan asks for it again.
 */
async function doneSet(user, roadmap) {
  const doc = roadmap.toObject ? roadmap.toObject() : roadmap;
  const ids = trackedIds(doc.schedule);
  const objectIds = ids.filter((id) => OBJECT_ID.test(id));
  const quizSubtopics = [...new Set(doc.schedule.flatMap((d) => d.tasks.filter((t) => t.type === 'quiz').map((t) => t.subtopic)))];

  const [problems, items, quizzes] = await Promise.all([
    objectIds.length ? ProblemProgress.find({ user: user._id, problem: { $in: objectIds } }).select('problem').lean() : [],
    objectIds.length ? StudyProgress.find({ user: user._id, item: { $in: objectIds } }).select('item').lean() : [],
    quizSubtopics.length
      ? TestAttempt.find({ user: user._id, status: 'submitted', focusSubtopic: { $in: quizSubtopics }, submittedAt: { $gte: doc.createdAt } })
          .select('subject focusSubtopic')
          .lean()
      : [],
  ]);

  const done = new Set();
  problems.forEach((r) => done.add(String(r.problem)));
  items.forEach((r) => done.add(String(r.item)));
  quizzes.forEach((r) => done.add(quizKey(r.subject, r.focusSubtopic)));
  return done;
}

/**
 * Build and save a new roadmap version from the student's latest skill levels.
 * The plan always covers the days that remain until the deadline, starting today, so a
 * reschedule never replays days that have already passed.
 */
async function createRoadmap({ user, reason = 'initial', now = new Date() }) {
  if (!user.goal || !user.goal.company || !user.goal.deadline || !user.goal.hoursPerDay) {
    throw conflict('Set your goal (company, deadline and hours per day) first', 'goal_missing');
  }
  const company = await Company.findById(user.goal.company);
  if (!company) throw conflict('The selected company no longer exists. Update your goal.', 'company_missing');

  const tested = await TestAttempt.countDocuments({ user: user._id, status: 'submitted' });
  if (!tested) throw conflict('Take a diagnostic test first so the roadmap can be based on your skills', 'no_tests');

  const today = dayKey(now, user.timezone);
  const daysRemaining = dayDiff(today, user.goal.deadline) + 1;
  if (daysRemaining < 1) throw conflict('Your deadline has passed. Update your goal to plan again.', 'deadline_passed');

  const levels = await loadLevels(user._id);
  const scores = subjectScores(levels);
  const requirements = company.skills.map((s) => ({ subject: s.subject, weight: s.weight }));
  const gaps = analyzeGaps({ requirements, subjectScores: scores });

  const keysBySubject = Object.fromEntries(Object.keys(TAXONOMY).map((s) => [s, subtopicKeys(s)]));
  const subtopics = subtopicPriorities({ gaps, subtopicKeysBySubject: keysBySubject, subtopicLevels: levels }).map((s) => ({
    ...s,
    label: subtopicLabel(s.subject, s.subtopic),
  }));

  const solved = await solvedSet(user._id);
  const doneItems = await doneItemSet(user._id);
  const items = (await StudyItem.find({ active: true, subject: { $in: gaps.map((g) => g.subject) } }).sort({ type: 1, createdAt: 1, _id: 1 }).lean())
    // A finished practical is not set again after a reschedule; resources stay so they can be re-read.
    .filter((i) => !(i.type === 'practical' && doneItems.has(String(i._id))))
    .map((i) => ({ id: String(i._id), type: i.type, title: i.title, description: i.description, url: i.url, minutes: i.minutes, subject: i.subject, subtopic: i.subtopic }));
  const problems = (
    await Problem.find({ active: true, subject: { $in: gaps.map((g) => g.subject) } }).lean()
  )
    .filter((p) => !solved.has(String(p._id)))
    .map((p) => ({ id: String(p._id), title: p.title, url: p.url, subject: p.subject, subtopic: p.subtopic, difficulty: p.difficulty }));

  const plan = buildPlan({ days: daysRemaining, hoursPerDay: user.goal.hoursPerDay, startDate: today, subtopics, problems, items });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latest = await Roadmap.findOne({ user: user._id }).sort({ version: -1 }).select('version').lean();
    const version = (latest ? latest.version : 0) + 1;
    try {
      const roadmap = await Roadmap.create({
        user: user._id,
        version,
        isActive: true,
        reason: version === 1 ? 'initial' : reason,
        company: { id: company._id, name: company.name, slug: company.slug, role: company.role },
        goal: { deadline: user.goal.deadline, hoursPerDay: user.goal.hoursPerDay, daysRemaining },
        startDate: today,
        gaps,
        allocations: plan.allocations,
        skipped: plan.skipped.map((s) => ({ subject: s.subject, subtopic: s.subtopic, label: s.label, level: s.level })),
        schedule: plan.schedule,
        mastered: plan.mastered,
      });
      await Roadmap.updateMany({ user: user._id, _id: { $ne: roadmap._id }, isActive: true }, { $set: { isActive: false } });
      return roadmap;
    } catch (err) {
      // Two reschedules at once picked the same version number; take the next one.
      if (err.code !== 11000) throw err;
    }
  }
  throw conflict('Could not save the roadmap, please try again', 'version_conflict');
}

async function getActive(user) {
  const roadmap = await Roadmap.findOne({ user: user._id, isActive: true }).sort({ version: -1 });
  if (!roadmap) throw notFound('No roadmap yet. Generate one after your first test.');
  return roadmap;
}

/** done: the Set from doneSet(). doneIds lists the finished tracked tasks (problem ids, item ids, quiz keys). */
function summarize(roadmap, done) {
  const doc = roadmap.toObject ? roadmap.toObject() : roadmap;
  return {
    ...doc,
    id: String(doc._id),
    progressPercent: progressPercent(doc.schedule, done),
    doneIds: trackedIds(doc.schedule).filter((id) => done.has(id)),
  };
}

/** Load a roadmap's completion and summarise it in one go. */
async function present(user, roadmap) {
  return summarize(roadmap, await doneSet(user, roadmap));
}

async function listVersions(user) {
  const rows = await Roadmap.find({ user: user._id }).sort({ version: -1 }).select('version isActive reason createdAt startDate goal company mastered').lean();
  return rows.map((r) => ({ id: String(r._id), version: r.version, isActive: r.isActive, reason: r.reason, createdAt: r.createdAt, startDate: r.startDate, daysRemaining: r.goal && r.goal.daysRemaining, company: r.company && r.company.name, mastered: r.mastered }));
}

async function getVersion(user, version) {
  const roadmap = await Roadmap.findOne({ user: user._id, version });
  if (!roadmap) throw notFound('Roadmap version not found');
  return roadmap;
}

async function dailyPlan({ user, now = new Date() }) {
  const roadmap = await getActive(user);
  const solved = await doneSet(user, roadmap);
  const plan = computeDailyPlan({ schedule: roadmap.schedule.map((d) => d.toObject()), startDate: roadmap.startDate, today: dayKey(now, user.timezone), solved });
  return { roadmapVersion: roadmap.version, ...plan };
}

async function setProblemSolved({ user, problemId, solved }) {
  const problem = await Problem.findById(problemId);
  if (!problem) throw notFound('Problem not found');
  if (solved) {
    await ProblemProgress.updateOne({ user: user._id, problem: problem._id }, { $setOnInsert: { solvedAt: new Date() } }, { upsert: true });
  } else {
    await ProblemProgress.deleteOne({ user: user._id, problem: problem._id });
  }
  return { problemId: String(problem._id), solved };
}

async function setItemDone({ user, itemId, done }) {
  const item = await StudyItem.findById(itemId);
  if (!item) throw notFound('Study item not found');
  if (done) {
    await StudyProgress.updateOne({ user: user._id, item: item._id }, { $setOnInsert: { doneAt: new Date() } }, { upsert: true });
  } else {
    await StudyProgress.deleteOne({ user: user._id, item: item._id });
  }
  return { itemId: String(item._id), done };
}

module.exports = { createRoadmap, getActive, summarize, present, listVersions, getVersion, dailyPlan, setProblemSolved, setItemDone, solvedSet, doneSet };
