'use strict';

const { SUBJECTS, DIFFICULTIES, TAXONOMY, isValidSubtopic } = require('../src/config/taxonomy');
const { questionHash } = require('../src/services/questionGenerator');

/** Returns a list of human-readable problems with the seed data; empty means it is sound. */
function validateSeed({ questions, problems, companies, studyItems = [] }) {
  const errors = [];

  const hashes = new Set();
  questions.forEach((q, i) => {
    const where = `question #${i + 1} (${q.subject}/${q.subtopic})`;
    if (!SUBJECTS.includes(q.subject)) errors.push(`${where}: unknown subject`);
    if (!isValidSubtopic(q.subject, q.subtopic)) errors.push(`${where}: unknown subtopic`);
    if (!DIFFICULTIES.includes(q.difficulty)) errors.push(`${where}: bad difficulty`);
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${where}: needs 4 options`);
    else if (new Set(q.options.map((o) => o.toLowerCase())).size !== 4) errors.push(`${where}: options are not distinct`);
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) errors.push(`${where}: bad correctIndex`);
    if (!q.explanation || q.explanation.length < 10) errors.push(`${where}: missing explanation`);
    const h = questionHash(q.text);
    if (hashes.has(h)) errors.push(`${where}: duplicate question text`);
    hashes.add(h);
  });

  const urls = new Set();
  problems.forEach((p, i) => {
    const where = `problem #${i + 1} (${p.title})`;
    if (!isValidSubtopic(p.subject, p.subtopic)) errors.push(`${where}: unknown subject/subtopic`);
    if (!DIFFICULTIES.includes(p.difficulty)) errors.push(`${where}: bad difficulty`);
    if (!/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/.test(p.url)) errors.push(`${where}: bad url ${p.url}`);
    if (urls.has(p.url)) errors.push(`${where}: duplicate url`);
    urls.add(p.url);
  });

  const itemKeys = new Set();
  studyItems.forEach((it, i) => {
    const where = `study item #${i + 1} (${it.title})`;
    if (!isValidSubtopic(it.subject, it.subtopic)) errors.push(`${where}: unknown subject/subtopic`);
    if (!['resource', 'practical'].includes(it.type)) errors.push(`${where}: bad type`);
    if (!Number.isInteger(it.minutes) || it.minutes < 5 || it.minutes > 240) errors.push(`${where}: minutes must be 5 to 240`);
    if (it.type === 'resource' && !/^https:\/\/\S+$/.test(it.url || '')) errors.push(`${where}: a resource needs an https link`);
    if (it.type === 'practical' && (!it.description || it.description.length < 30)) errors.push(`${where}: a practical needs real instructions`);
    const key = [it.subject, it.subtopic, it.type, it.title].join('|');
    if (itemKeys.has(key)) errors.push(`${where}: duplicate`);
    itemKeys.add(key);
  });

  const slugs = new Set();
  companies.forEach((c) => {
    if (slugs.has(c.slug)) errors.push(`company ${c.name}: duplicate slug`);
    slugs.add(c.slug);
    if (new Set(c.skills.map((s) => s.subject)).size !== c.skills.length) errors.push(`company ${c.name}: repeated subject`);
  });

  return errors;
}

/** Counts per subject, subtopic and difficulty, used by the tests and by `npm run seed`. */
function summarize({ questions, problems }) {
  const bySubtopic = {};
  for (const q of questions) {
    const key = `${q.subject}/${q.subtopic}`;
    const e = (bySubtopic[key] = bySubtopic[key] || { easy: 0, medium: 0, hard: 0 });
    e[q.difficulty] += 1;
  }
  const subjects = Object.keys(TAXONOMY).map((s) => ({
    subject: s,
    questions: questions.filter((q) => q.subject === s).length,
    problems: problems.filter((p) => p.subject === s).length,
  }));
  return { bySubtopic, subjects };
}

module.exports = { validateSeed, summarize };
