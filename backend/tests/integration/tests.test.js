'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { createGenerationQueue } = require('../../src/services/generationQueue');
const Question = require('../../src/models/Question');
const Skill = require('../../src/models/Skill');
const f = require('../helpers/fixtures');

f.describeDb('test and submit API', () => {
  let app;
  beforeAll(async () => {
    await f.connect();
    app = createApp();
  });
  afterAll(f.disconnect);
  beforeEach(async () => {
    await f.clearAll();
    await f.seedQuestions('DSA', 2); // 9 subtopics x 3 difficulties x 2 = 54 questions
  });

  const start = (user, body = { subject: 'DSA', count: 9 }) => request(app).post('/api/tests/start').set(user.auth).send(body);

  test('requires login', async () => {
    expect((await request(app).post('/api/tests/start').send({ subject: 'DSA' })).status).toBe(401);
  });

  test('rejects an unknown subject or silly counts', async () => {
    const user = await f.registerUser(app);
    expect((await start(user, { subject: 'Cooking', count: 9 })).status).toBe(400);
    expect((await start(user, { subject: 'DSA', count: 1 })).status).toBe(400);
    expect((await start(user, { subject: 'DSA', count: 500 })).status).toBe(400);
  });

  test('starts a test with one question per subtopic and never leaks the answer key', async () => {
    const user = await f.registerUser(app);
    const res = await start(user);
    expect(res.status).toBe(201);
    const { test } = res.body;
    expect(test.questions).toHaveLength(9);
    expect(new Set(test.questions.map((q) => q.subtopic)).size).toBe(9);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/correctIndex|explanation|"hash"|timesCorrect/);
    test.questions.forEach((q) => expect(Object.keys(q).sort()).toEqual(['difficulty', 'id', 'options', 'subject', 'subtopic', 'text']));

    const fetched = await request(app).get(`/api/tests/${test.id}`).set(user.auth);
    expect(fetched.status).toBe(200);
    expect(JSON.stringify(fetched.body)).not.toMatch(/correctIndex|explanation/);
  });

  test('only approved questions are ever served', async () => {
    await Question.updateMany({ subtopic: { $ne: 'arrays' } }, { $set: { status: 'pending' } });
    const user = await f.registerUser(app);
    const res = await start(user, { subject: 'DSA', count: 5 });
    expect(res.status).toBe(201);
    expect(res.body.test.questions.every((q) => q.subtopic === 'arrays')).toBe(true);
  });

  test('says so clearly when there are no approved questions', async () => {
    await Question.updateMany({}, { $set: { status: 'pending' } });
    const user = await f.registerUser(app);
    const res = await start(user);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('no_questions');
  });

  test('starting again while a test is open resumes it instead of creating another', async () => {
    const user = await f.registerUser(app);
    const a = await start(user);
    const b = await start(user);
    expect(b.status).toBe(200);
    expect(b.body.test.id).toBe(a.body.test.id);
    expect(b.body.test.resumed).toBe(true);
  });

  test('submit scores the test, returns explanations, and updates skill levels by level += 0.3 * (score - level)', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    const res = await f.answerTest(app, user, test, () => true);
    expect(res.status).toBe(200);
    const { result } = res.body;
    expect(result.score).toBe(1);
    expect(result.correctCount).toBe(9);
    result.review.forEach((r) => {
      expect(r.correct).toBe(true);
      expect(r.explanation).toEqual(expect.any(String));
      expect(r.correctIndex).toBe(r.selectedIndex);
    });
    result.subtopics.forEach((s) => {
      expect(s.levelBefore).toBeCloseTo(0.5, 10);
      expect(s.levelAfter).toBeCloseTo(0.65, 10);
    });
    const skills = await Skill.find({ user: user.user.id });
    expect(skills).toHaveLength(9);
    skills.forEach((s) => expect(s.level).toBeCloseTo(0.65, 10));
    expect(result.streak).toBe(1);
  });

  test('wrong and unanswered questions lower the level', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    const res = await request(app).post(`/api/tests/${test.id}/submit`).set(user.auth).send({ answers: [] });
    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(0);
    res.body.result.subtopics.forEach((s) => expect(s.levelAfter).toBeCloseTo(0.35, 10));
  });

  test('updates timesAsked and timesCorrect on each question', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    await f.answerTest(app, user, test, (q, i) => i % 2 === 0);
    const docs = await Question.find({ _id: { $in: test.questions.map((q) => q.id) } });
    docs.forEach((d) => expect(d.timesAsked).toBe(1));
    expect(docs.reduce((s, d) => s + d.timesCorrect, 0)).toBe(5);
  });

  test('a test cannot be submitted twice', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    expect((await f.answerTest(app, user, test)).status).toBe(200);
    const again = await f.answerTest(app, user, test);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_submitted');
    expect(await Skill.findOne({ user: user.user.id })).toMatchObject({ attempts: 1 });
  });

  test('two simultaneous submits only count once', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    const results = await Promise.all([f.answerTest(app, user, test), f.answerTest(app, user, test)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const docs = await Question.find({ _id: { $in: test.questions.map((q) => q.id) } });
    docs.forEach((d) => expect(d.timesAsked).toBe(1));
  });

  test("a student cannot read or submit someone else's test", async () => {
    const owner = await f.registerUser(app);
    const other = await f.registerUser(app);
    const { test } = (await start(owner)).body;
    expect((await request(app).get(`/api/tests/${test.id}`).set(other.auth)).status).toBe(404);
    expect((await f.answerTest(app, other, test)).status).toBe(404);
  });

  test('answers for questions outside the test are rejected', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    const outsider = await Question.findOne({ _id: { $nin: test.questions.map((q) => q.id) } });
    const res = await request(app)
      .post(`/api/tests/${test.id}/submit`)
      .set(user.auth)
      .send({ answers: [{ questionId: String(outsider._id), selectedIndex: 0 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_question');
  });

  test('malformed submissions fail validation', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    const bad = await request(app).post(`/api/tests/${test.id}/submit`).set(user.auth).send({ answers: [{ questionId: 'x', selectedIndex: 9 }] });
    expect(bad.status).toBe(400);
    expect((await request(app).get('/api/tests/not-an-id').set(user.auth)).status).toBe(400);
  });

  test('after submitting, the result page shows the review and history lists the test', async () => {
    const user = await f.registerUser(app);
    const { test } = (await start(user)).body;
    await f.answerTest(app, user, test, (q, i) => i < 3);
    const res = await request(app).get(`/api/tests/${test.id}`).set(user.auth);
    expect(res.body.test.status).toBe('submitted');
    expect(res.body.test.review).toHaveLength(9);
    const list = await request(app).get('/api/tests').set(user.auth);
    expect(list.body.tests).toHaveLength(1);
    expect(list.body.tests[0].score).toBeCloseTo(3 / 9, 10);
  });

  test('retests never repeat a question while unseen ones remain', async () => {
    const user = await f.registerUser(app);
    const seen = new Set();
    for (let round = 0; round < 6; round += 1) {
      const { test } = (await start(user)).body; // 6 questions per subtopic, 1 per test
      test.questions.forEach((q) => {
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      });
      await f.answerTest(app, user, test);
    }
    expect(seen.size).toBe(54);
  });

  test('retests pick difficulty from the skill level', async () => {
    const user = await f.registerUser(app);
    await Skill.create({ user: user.user.id, subject: 'DSA', subtopic: 'trees', level: 0.1 });
    await Skill.create({ user: user.user.id, subject: 'DSA', subtopic: 'graphs', level: 0.9 });
    const { test } = (await start(user)).body;
    expect(test.questions.find((q) => q.subtopic === 'trees').difficulty).toBe('easy');
    expect(test.questions.find((q) => q.subtopic === 'graphs').difficulty).toBe('hard');
    expect(test.questions.find((q) => q.subtopic === 'arrays').difficulty).toBe('medium');
  });

  test('once every question has been seen, the oldest-seen ones are reused', async () => {
    await f.clearAll();
    await f.seedQuestions('OOP', 1); // 5 subtopics x 3 = 15 questions, 3 per subtopic
    const user = await f.registerUser(app);
    const firstSeen = [];
    for (let round = 0; round < 3; round += 1) {
      const { test } = (await start(user, { subject: 'OOP', count: 5 })).body;
      if (round === 0) firstSeen.push(...test.questions.map((q) => q.id));
      await f.answerTest(app, user, test);
    }
    const fourth = (await start(user, { subject: 'OOP', count: 5 })).body.test;
    expect(fourth.questions).toHaveLength(5);
    // Fallback picks the oldest-seen question in each subtopic, which came from round one.
    fourth.questions.forEach((q) => expect(firstSeen).toContain(q.id));
  });

  test('when a subtopic runs out, Gemini is asked for more and the results wait as pending', async () => {
    await f.clearAll();
    await f.seedQuestions('OOP', 1);
    let n = 0;
    const gemini = {
      enabled: true,
      generateJson: async (prompt) => {
        if (prompt.includes('Answer this multiple-choice question independently')) return { answerIndex: 2 };
        const questions = [1, 2, 3].map(() => {
          n += 1;
          return {
            text: `Generated OOP question number ${n} about a concept?`,
            options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`],
            correctIndex: 2,
            explanation: 'Because the third option is the right one.',
          };
        });
        return { questions };
      },
    };
    const queue = createGenerationQueue({ gemini });
    const genApp = createApp({ gemini, generationQueue: queue });
    const user = await f.registerUser(genApp);

    for (let round = 0; round < 4; round += 1) {
      const res = await request(genApp).post('/api/tests/start').set(user.auth).send({ subject: 'OOP', count: 5 });
      expect(res.status).toBe(201);
      await f.answerTest(genApp, user, res.body.test);
    }
    for (let i = 0; i < 50 && queue.pending() > 0; i += 1) await new Promise((r) => setTimeout(r, 20));

    const generated = await Question.find({ source: 'gemini' });
    expect(generated.length).toBeGreaterThan(0);
    generated.forEach((q) => {
      expect(q.status).toBe('pending');
      expect(q.verified).toBe(true);
    });

    const next = await request(genApp).post('/api/tests/start').set(user.auth).send({ subject: 'OOP', count: 5 });
    const pendingIds = new Set(generated.map((q) => String(q._id)));
    next.body.test.questions.forEach((q) => expect(pendingIds.has(q.id)).toBe(false));
  });

  describe('subtopic quizzes', () => {
    test('a quiz covers only the chosen subtopic', async () => {
      const user = await f.registerUser(app);
      const res = await start(user, { subject: 'DSA', subtopic: 'trees', count: 5 });
      expect(res.status).toBe(201);
      expect(res.body.test.focusSubtopic).toBe('trees');
      expect(res.body.test.questions).toHaveLength(5);
      const docs = await Question.find({ _id: { $in: res.body.test.questions.map((q) => q.id) } });
      docs.forEach((d) => expect(d.subtopic).toBe('trees'));
    });

    test('an unknown subtopic, or one from another subject, is rejected', async () => {
      const user = await f.registerUser(app);
      expect((await start(user, { subject: 'DSA', subtopic: 'nope', count: 5 })).status).toBe(400);
      expect((await start(user, { subject: 'DSA', subtopic: 'joins', count: 5 })).status).toBe(400);
    });

    test('a quiz and a full test are resumed independently', async () => {
      const user = await f.registerUser(app);
      const full = await start(user);
      const quiz = await start(user, { subject: 'DSA', subtopic: 'trees', count: 5 });
      expect(quiz.body.test.id).not.toBe(full.body.test.id);
      expect((await start(user)).body.test.id).toBe(full.body.test.id);
      expect((await start(user, { subject: 'DSA', subtopic: 'trees', count: 5 })).body.test.id).toBe(quiz.body.test.id);
      expect((await start(user, { subject: 'DSA', subtopic: 'graphs', count: 5 })).body.test.id).not.toBe(quiz.body.test.id);
    });

    test('a quiz updates that subtopic skill only and reports a single subtopic', async () => {
      const user = await f.registerUser(app);
      const quiz = await start(user, { subject: 'DSA', subtopic: 'trees', count: 5 });
      const res = await f.answerTest(app, user, quiz.body.test);
      expect(res.status).toBe(200);
      expect(res.body.result.subtopics.map((s) => s.subtopic)).toEqual(['trees']);
      const skills = await Skill.find({ user: user.user.id });
      expect(skills.map((s) => s.subtopic)).toEqual(['trees']);
      expect(skills[0].level).toBeGreaterThan(0.5);
    });

    test('the attempt list and the result keep the focus', async () => {
      const user = await f.registerUser(app);
      const quiz = await start(user, { subject: 'DSA', subtopic: 'trees', count: 5 });
      await f.answerTest(app, user, quiz.body.test);
      const list = await request(app).get('/api/tests').set(user.auth);
      expect(list.body.tests[0].focusSubtopic).toBe('trees');
      const result = await request(app).get(`/api/tests/${quiz.body.test.id}`).set(user.auth);
      expect(result.body.test.focusSubtopic).toBe('trees');
    });
  });
});
