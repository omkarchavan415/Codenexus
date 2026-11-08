'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const Question = require('../../src/models/Question');
const Problem = require('../../src/models/Problem');
const ProblemProgress = require('../../src/models/ProblemProgress');
const StudyItem = require('../../src/models/StudyItem');
const StudyProgress = require('../../src/models/StudyProgress');
const User = require('../../src/models/User');
const f = require('../helpers/fixtures');

const goodQuestion = (n = 1) => ({
  subject: 'DSA',
  subtopic: 'arrays',
  difficulty: 'easy',
  text: `Admin-created question number ${n}: what is the index of the first element?`,
  options: ['0', '1', '-1', 'It depends'],
  correctIndex: 0,
  explanation: 'Arrays are zero-indexed in most languages.',
});

async function makeAdmin(app) {
  const user = await f.registerUser(app);
  await User.updateOne({ email: user.email }, { $set: { role: 'admin' } });
  // The role is read from the database on every request, so the existing token is enough.
  return user;
}

f.describeDb('admin API', () => {
  let app;
  let admin;
  let student;

  beforeAll(async () => {
    await f.connect();
    app = createApp({
      gemini: { enabled: false, generateJson: async () => { throw new Error('not configured'); } },
    });
  });
  afterAll(f.disconnect);
  beforeEach(async () => {
    await f.clearAll();
    admin = await makeAdmin(app);
    student = await f.registerUser(app);
  });

  test('every admin route refuses anonymous callers and students', async () => {
    const paths = ['/api/admin/questions', '/api/admin/stats', '/api/admin/companies', '/api/admin/problems', '/api/admin/study-items', '/api/admin/quality'];
    for (const p of paths) {
      expect((await request(app).get(p)).status).toBe(401);
      expect((await request(app).get(p).set(student.auth)).status).toBe(403);
    }
  });

  describe('questions', () => {
    test('create, list with filters, edit and delete', async () => {
      const created = await request(app).post('/api/admin/questions').set(admin.auth).send(goodQuestion(1));
      expect(created.status).toBe(201);
      expect(created.body.question.status).toBe('approved');
      const id = created.body.question._id;

      const list = await request(app).get('/api/admin/questions?subject=DSA&difficulty=easy&q=admin-created').set(admin.auth);
      expect(list.status).toBe(200);
      expect(list.body.total).toBe(1);
      expect(list.body.questions[0].correctIndex).toBe(0); // admins do see the key

      const edited = await request(app)
        .put(`/api/admin/questions/${id}`)
        .set(admin.auth)
        .send({ ...goodQuestion(1), difficulty: 'medium', correctIndex: 1 });
      expect(edited.status).toBe(200);
      expect(edited.body.question.difficulty).toBe('medium');

      const removed = await request(app).delete(`/api/admin/questions/${id}`).set(admin.auth);
      expect(removed.body.deleted).toBe(true);
      expect(await Question.countDocuments()).toBe(0);
    });

    test('rejects invalid questions and duplicates', async () => {
      const bad = { ...goodQuestion(2), subtopic: 'joins' };
      expect((await request(app).post('/api/admin/questions').set(admin.auth).send(bad)).status).toBe(400);
      expect((await request(app).post('/api/admin/questions').set(admin.auth).send({ ...goodQuestion(2), options: ['a', 'a', 'b', 'c'] })).status).toBe(400);
      expect((await request(app).post('/api/admin/questions').set(admin.auth).send(goodQuestion(2))).status).toBe(201);
      const dup = await request(app).post('/api/admin/questions').set(admin.auth).send(goodQuestion(2));
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('duplicate');
    });

    test('a question students have answered is archived, not erased', async () => {
      const q = await Question.create({ ...goodQuestion(3), status: 'approved', timesAsked: 4, timesCorrect: 2 });
      const res = await request(app).delete(`/api/admin/questions/${q._id}`).set(admin.auth);
      expect(res.body.archived).toBe(true);
      expect((await Question.findById(q._id)).status).toBe('rejected');
    });

    test('approve and reject pending questions, singly and in bulk', async () => {
      const a = await Question.create({ ...goodQuestion(4), status: 'pending', source: 'gemini' });
      const b = await Question.create({ ...goodQuestion(5), status: 'pending', source: 'gemini' });
      const c = await Question.create({ ...goodQuestion(6), status: 'pending', source: 'gemini' });

      const one = await request(app).post(`/api/admin/questions/${a._id}/review`).set(admin.auth).send({ action: 'approve' });
      expect(one.body.question.status).toBe('approved');

      const bulk = await request(app).post('/api/admin/questions/bulk-review').set(admin.auth).send({ ids: [String(b._id), String(c._id)], action: 'reject' });
      expect(bulk.body.modified).toBe(2);
      expect(await Question.countDocuments({ status: 'rejected' })).toBe(2);
    });

    test('bulk import from JSON and CSV reports duplicates and bad rows', async () => {
      const json = JSON.stringify([goodQuestion(7), goodQuestion(8), { ...goodQuestion(9), subtopic: 'nope' }]);
      const res = await request(app).post('/api/admin/questions/import').set(admin.auth).send({ format: 'json', content: json });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ received: 3, created: 2, duplicates: 0 });
      expect(res.body.invalid).toHaveLength(1);

      const again = await request(app).post('/api/admin/questions/import').set(admin.auth).send({ format: 'json', content: json });
      expect(again.body).toMatchObject({ created: 0, duplicates: 2 });

      const csv = [
        'subject,subtopic,difficulty,text,optionA,optionB,optionC,optionD,correct,explanation',
        'SQL,joins,medium,"Which join keeps every row of the left table?",INNER,LEFT,RIGHT,CROSS,B,LEFT JOIN preserves all left rows.',
      ].join('\n');
      const fromCsv = await request(app).post('/api/admin/questions/import').set(admin.auth).send({ format: 'csv', content: csv, status: 'pending' });
      expect(fromCsv.body.created).toBe(1);
      expect((await Question.findOne({ subject: 'SQL' })).status).toBe('pending');
    });

    test('a malformed import is a clear 400', async () => {
      const res = await request(app).post('/api/admin/questions/import').set(admin.auth).send({ format: 'json', content: '{oops' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('bad_import');
    });
  });

  describe('generator', () => {
    test('reports that Gemini is not configured instead of failing', async () => {
      const res = await request(app).post('/api/admin/generate').set(admin.auth).send({ subject: 'DSA', subtopic: 'arrays', difficulty: 'easy', count: 3 });
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe('gemini_not_configured');
      expect(res.body.created).toEqual([]);
    });

    test('saves verified generated questions as pending', async () => {
      const gemini = {
        enabled: true,
        generateJson: jest.fn(async (prompt) =>
          prompt.startsWith('Answer this')
            ? { answerIndex: 2 }
            : { questions: [{ text: 'Which structure gives O(1) average lookup by key?', options: ['Array scan', 'Linked list', 'Hash table', 'Stack'], correctIndex: 2, explanation: 'Hash tables index by hashed key.' }] },
        ),
      };
      const geminiApp = createApp({ gemini });
      const res = await request(geminiApp).post('/api/admin/generate').set(admin.auth).send({ subject: 'DSA', subtopic: 'hashing', difficulty: 'easy', count: 1 });
      expect(res.status).toBe(200);
      expect(res.body.created).toHaveLength(1);
      const saved = await Question.findOne({ source: 'gemini' });
      expect(saved.status).toBe('pending');
      expect(saved.verified).toBe(true);
    });

    test('validates the request', async () => {
      const res = await request(app).post('/api/admin/generate').set(admin.auth).send({ subject: 'DSA', subtopic: 'joins', difficulty: 'easy', count: 3 });
      expect(res.status).toBe(400);
    });
  });

  describe('quality', () => {
    test('lists flagged questions using timesAsked and timesCorrect', async () => {
      await Question.create({ ...goodQuestion(10), timesAsked: 40, timesCorrect: 2 });
      await Question.create({ ...goodQuestion(11), timesAsked: 40, timesCorrect: 24, difficulty: 'medium' });
      await Question.create({ ...goodQuestion(12), timesAsked: 3, timesCorrect: 0 });

      const all = await request(app).get('/api/admin/quality').set(admin.auth);
      expect(all.body.total).toBe(3);
      expect(all.body.questions[0].flag).toBe('possible_wrong_key');

      const flagged = await request(app).get('/api/admin/quality?flaggedOnly=true').set(admin.auth);
      expect(flagged.body.total).toBe(1);
    });

    test('an admin can flag a question manually', async () => {
      const q = await Question.create(goodQuestion(13));
      const res = await request(app).patch(`/api/admin/questions/${q._id}/flag`).set(admin.auth).send({ flagged: true });
      expect(res.body.question.flagged).toBe(true);
    });
  });

  describe('companies', () => {
    const body = { name: 'Acme Tech', role: 'SDE', skills: [{ subject: 'DSA', weight: 'high' }, { subject: 'SQL', weight: 'low' }] };

    test('create (slug derived), update and archive when students use it', async () => {
      const created = await request(app).post('/api/admin/companies').set(admin.auth).send(body);
      expect(created.status).toBe(201);
      expect(created.body.company.slug).toBe('acme-tech');

      const updated = await request(app)
        .put(`/api/admin/companies/${created.body.company.id}`)
        .set(admin.auth)
        .send({ ...body, skills: [{ subject: 'OS', weight: 'medium' }] });
      expect(updated.body.company.skills).toHaveLength(1);

      await User.updateOne({ _id: student.user.id }, { $set: { 'goal.company': created.body.company.id } });
      const removed = await request(app).delete(`/api/admin/companies/${created.body.company.id}`).set(admin.auth);
      expect(removed.body.archived).toBe(true);
    });

    test('rejects an empty or repeated skill list', async () => {
      expect((await request(app).post('/api/admin/companies').set(admin.auth).send({ ...body, skills: [] })).status).toBe(400);
      const repeated = [{ subject: 'DSA', weight: 'high' }, { subject: 'DSA', weight: 'low' }];
      expect((await request(app).post('/api/admin/companies').set(admin.auth).send({ ...body, skills: repeated })).status).toBe(400);
    });
  });

  describe('problems', () => {
    const body = { title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', subject: 'DSA', subtopic: 'hashing', difficulty: 'easy' };

    test('only real LeetCode links are accepted', async () => {
      expect((await request(app).post('/api/admin/problems').set(admin.auth).send({ ...body, url: 'https://example.com/two-sum' })).status).toBe(400);
      expect((await request(app).post('/api/admin/problems').set(admin.auth).send(body)).status).toBe(201);
      expect((await request(app).post('/api/admin/problems').set(admin.auth).send(body)).status).toBe(409);
    });

    test('a problem students have solved is archived, not erased', async () => {
      const p = await Problem.create(body);
      await ProblemProgress.create({ user: student.user.id, problem: p._id });
      const res = await request(app).delete(`/api/admin/problems/${p._id}`).set(admin.auth);
      expect(res.body.archived).toBe(true);
      expect((await Problem.findById(p._id)).active).toBe(false);
    });
  });

  describe('study items', () => {
    const resource = { type: 'resource', title: 'Read about B-trees', url: 'https://example.com/btree', minutes: 20, subject: 'DBMS', subtopic: 'indexing' };
    const practical = { type: 'practical', title: 'Measure an index', description: 'Run EXPLAIN before and after creating an index.', minutes: 30, subject: 'DBMS', subtopic: 'indexing' };

    test('creates, lists with filters, edits and validates', async () => {
      expect((await request(app).post('/api/admin/study-items').set(admin.auth).send(resource)).status).toBe(201);
      expect((await request(app).post('/api/admin/study-items').set(admin.auth).send(practical)).status).toBe(201);

      const all = await request(app).get('/api/admin/study-items').set(admin.auth);
      expect(all.body.total).toBe(2);
      expect((await request(app).get('/api/admin/study-items?type=practical').set(admin.auth)).body.items).toHaveLength(1);
      expect((await request(app).get('/api/admin/study-items?subject=OS').set(admin.auth)).body.total).toBe(0);
      expect((await request(app).get('/api/admin/study-items?q=b-tree').set(admin.auth)).body.total).toBe(1);

      const id = all.body.items.find((i) => i.type === 'resource').id;
      const edited = await request(app).put(`/api/admin/study-items/${id}`).set(admin.auth).send({ ...resource, minutes: 45 });
      expect(edited.status).toBe(200);
      expect(edited.body.item.minutes).toBe(45);

      expect((await request(app).post('/api/admin/study-items').set(admin.auth).send({ ...resource, url: '' })).status).toBe(400);
      expect((await request(app).post('/api/admin/study-items').set(admin.auth).send({ ...practical, description: '' })).status).toBe(400);
      expect((await request(app).post('/api/admin/study-items').set(admin.auth).send({ ...resource, subtopic: 'joins' })).status).toBe(400);
      expect((await request(app).post('/api/admin/study-items').set(admin.auth).send({ ...resource, url: 'javascript:alert(1)' })).status).toBe(400);
      expect((await request(app).post('/api/admin/study-items').set(admin.auth).send({ ...resource, extra: true })).status).toBe(400);
    });

    test('the same title and type for a subtopic is a conflict', async () => {
      await request(app).post('/api/admin/study-items').set(admin.auth).send(resource);
      const again = await request(app).post('/api/admin/study-items').set(admin.auth).send({ ...resource, url: 'https://example.com/other' });
      expect(again.status).toBe(409);
    });

    test('an item a student finished is archived, an unused one is erased', async () => {
      const used = await StudyItem.create(resource);
      const unused = await StudyItem.create(practical);
      await StudyProgress.create({ user: student.user.id, item: used._id });

      const archived = await request(app).delete(`/api/admin/study-items/${used._id}`).set(admin.auth);
      expect(archived.body.archived).toBe(true);
      expect((await StudyItem.findById(used._id)).active).toBe(false);

      const erased = await request(app).delete(`/api/admin/study-items/${unused._id}`).set(admin.auth);
      expect(erased.body.deleted).toBe(true);
      expect(await StudyItem.findById(unused._id)).toBeNull();
    });
  });

  test('stats summarise users, attempts and question counts by status', async () => {
    await Question.create(goodQuestion(20));
    await Question.create({ ...goodQuestion(21), status: 'pending' });
    const res = await request(app).get('/api/admin/stats').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.users).toMatchObject({ total: 2, students: 1, admins: 1 });
    expect(res.body.questions.byStatus).toMatchObject({ approved: 1, pending: 1, rejected: 0 });
    expect(res.body.questions.approvedBySubject.DSA).toBe(1);
  });

  test('a deleted question no longer breaks a past test result', async () => {
    await f.seedQuestions('DSA', 1);
    await f.seedCompany();
    const test = (await request(app).post('/api/tests/start').set(student.auth).send({ subject: 'DSA', count: 9 })).body.test;
    const submitted = await f.answerTest(app, student, test);
    expect(submitted.status).toBe(200);
    await Question.deleteOne({ _id: test.questions[0].id });
    const again = await request(app).get(`/api/tests/${test.id}`).set(student.auth);
    expect(again.status).toBe(200);
    expect(again.body.test.review).toHaveLength(8);
  });
});
