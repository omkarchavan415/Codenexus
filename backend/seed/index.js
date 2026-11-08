'use strict';

/**
 * Seeds the question bank, LeetCode problems and company profiles. Safe to run repeatedly:
 * records are matched by question text hash, problem URL and company slug, so existing
 * records (and the statistics students have generated on them) are left alone.
 *
 *   npm run seed            add anything missing
 *   npm run seed -- --reset wipe questions, problems and companies first (asks no questions: use with care)
 */
const mongoose = require('mongoose');
const { env } = require('../src/config/env');
const Question = require('../src/models/Question');
const Problem = require('../src/models/Problem');
const Company = require('../src/models/Company');
const { questionHash } = require('../src/services/questionGenerator');
const { questions } = require('./data/questions');
const { problems } = require('./data/problems');
const { studyItems } = require('./data/studyItems');
const { retiredUrls } = require('./data/retired');
const StudyItem = require('../src/models/StudyItem');
const { companies } = require('./data/companies');
const { validateSeed } = require('./validate');

async function seed({ reset = false } = {}) {
  const errors = validateSeed({ questions, problems, companies, studyItems });
  if (errors.length) throw new Error(`Seed data is invalid:\n- ${errors.join('\n- ')}`);

  if (reset) {
    await Promise.all([Question.deleteMany({}), Problem.deleteMany({}), Company.deleteMany({}), StudyItem.deleteMany({})]);
  }

  const stats = { questions: 0, problems: 0, companies: 0, studyItems: 0, retired: 0 };

  const qOps = questions.map((q) => ({
    updateOne: {
      filter: { hash: questionHash(q.text) },
      update: { $setOnInsert: { ...q, hash: questionHash(q.text), status: 'approved', source: 'seed', verified: true } },
      upsert: true,
    },
  }));
  const qRes = await Question.bulkWrite(qOps, { ordered: false });
  stats.questions = qRes.upsertedCount;

  const pRes = await Problem.bulkWrite(
    problems.map((p) => ({ updateOne: { filter: { url: p.url }, update: { $setOnInsert: { ...p, active: true } }, upsert: true } })),
    { ordered: false },
  );
  stats.problems = pRes.upsertedCount;

  // Problems an earlier seed mapped to subtopics they do not teach: keep them (roadmaps link to them) but stop recommending them.
  const retired = await Problem.updateMany({ url: { $in: retiredUrls }, active: true }, { $set: { active: false } });
  stats.retired = retired.modifiedCount;

  const sRes = await StudyItem.bulkWrite(
    studyItems.map((it) => ({
      updateOne: {
        filter: { subject: it.subject, subtopic: it.subtopic, type: it.type, title: it.title },
        update: { $setOnInsert: { ...it, active: true } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  stats.studyItems = sRes.upsertedCount;

  const cRes = await Company.bulkWrite(
    companies.map((c) => ({ updateOne: { filter: { slug: c.slug }, update: { $setOnInsert: c }, upsert: true } })),
    { ordered: false },
  );
  stats.companies = cRes.upsertedCount;

  return stats;
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  await mongoose.syncIndexes();
  const stats = await seed({ reset: process.argv.includes('--reset') });
  console.log(`Seeded: ${stats.questions} new questions, ${stats.problems} new problems, ${stats.studyItems} new study items, ${stats.companies} new companies`);
  if (stats.retired) console.log(`Retired ${stats.retired} loosely related problems left over from an earlier seed`);
  console.log(
    `Bank now holds ${await Question.countDocuments()} questions, ${await Problem.countDocuments({ active: true })} active problems, ` +
      `${await StudyItem.countDocuments({ active: true })} study items, ${await Company.countDocuments()} companies`,
  );
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { seed };
