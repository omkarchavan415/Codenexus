'use strict';

const mongoose = require('mongoose');
const request = require('supertest');
const Question = require('../../src/models/Question');
const Problem = require('../../src/models/Problem');
const Company = require('../../src/models/Company');
const StudyItem = require('../../src/models/StudyItem');
const { TAXONOMY, subtopicKeys } = require('../../src/config/taxonomy');

const hasDb = !process.env.DB_UNAVAILABLE;
const describeDb = hasDb ? describe : describe.skip;

async function connect() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.TEST_MONGODB_URI;
  const name = `codenexus_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(uri, { dbName: name });
  await mongoose.syncIndexes();
}

async function disconnect() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

async function clearAll() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

let counter = 0;
const unique = (label) => {
  counter += 1;
  return `${label} (fixture ${counter}) - what is the correct statement?`;
};

/** `perDifficulty` approved questions at each difficulty for every subtopic of a subject. */
async function seedQuestions(subject, perDifficulty = 2) {
  const docs = [];
  for (const subtopic of subtopicKeys(subject)) {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (let i = 0; i < perDifficulty; i += 1) {
        docs.push({
          subject,
          subtopic,
          difficulty,
          text: unique(`${subject} ${subtopic} ${difficulty}`),
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: counter % 4,
          explanation: `Because option ${'ABCD'[counter % 4]} is right for this fixture question.`,
          status: 'approved',
          source: 'seed',
        });
      }
    }
  }
  return Question.create(docs);
}

async function seedProblems(subject, perDifficulty = 2) {
  const docs = [];
  for (const subtopic of subtopicKeys(subject)) {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (let i = 0; i < perDifficulty; i += 1) {
        const slug = `${subject.toLowerCase()}-${subtopic}-${difficulty}-${i}`;
        docs.push({ title: `Fixture ${slug}`, url: `https://leetcode.com/problems/${slug}/`, subject, subtopic, difficulty });
      }
    }
  }
  return Problem.create(docs);
}

/** Two resources for every subtopic of a subject, and one practical when `practicals` is true. */
async function seedStudyItems(subject, { practicals = false } = {}) {
  const docs = [];
  for (const subtopic of subtopicKeys(subject)) {
    docs.push({ type: 'resource', subject, subtopic, title: `Read ${subject} ${subtopic}`, url: `https://example.com/${subtopic}/read`, minutes: 20 });
    docs.push({ type: 'resource', subject, subtopic, title: `Watch ${subject} ${subtopic}`, url: `https://example.com/${subtopic}/watch`, minutes: 30 });
    if (practicals) docs.push({ type: 'practical', subject, subtopic, title: `Try ${subject} ${subtopic}`, description: 'Do this exercise by hand and write down what you saw.', minutes: 30 });
  }
  return StudyItem.create(docs);
}

async function seedCompany(overrides = {}) {
  return Company.create({
    name: 'Test Corp',
    slug: 'test-corp',
    role: 'Software Engineer',
    skills: [
      { subject: 'DSA', weight: 'high' },
      { subject: 'OOP', weight: 'medium' },
    ],
    ...overrides,
  });
}

let userCount = 0;
async function registerUser(app, overrides = {}) {
  userCount += 1;
  const body = { name: 'Test Student', email: `student${userCount}_${Date.now()}@example.com`, password: 'Password123', ...overrides };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, email: body.email, password: body.password, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
}

/** Answer every question in a started test. `pick(question, index)` returns true to answer correctly. */
async function answerTest(app, user, test, pick = () => true) {
  const ids = test.questions.map((q) => q.id);
  const docs = await Question.find({ _id: { $in: ids } });
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const answers = test.questions.map((q, i) => {
    const doc = byId.get(q.id);
    const right = pick(q, i);
    return { questionId: q.id, selectedIndex: right ? doc.correctIndex : (doc.correctIndex + 1) % 4 };
  });
  return request(app).post(`/api/tests/${test.id}/submit`).set(user.auth).send({ answers });
}

module.exports = {
  hasDb,
  describeDb,
  connect,
  disconnect,
  clearAll,
  seedQuestions,
  seedProblems,
  seedStudyItems,
  seedCompany,
  registerUser,
  answerTest,
  TAXONOMY,
};
