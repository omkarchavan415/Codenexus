'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const User = require('../../src/models/User');
const Roadmap = require('../../src/models/Roadmap');
const StudyItem = require('../../src/models/StudyItem');
const f = require('../helpers/fixtures');

f.describeDb('goal, roadmap and progress API', () => {
  let app;
  beforeAll(async () => {
    await f.connect();
    app = createApp();
  });
  afterAll(f.disconnect);
  beforeEach(async () => {
    await f.clearAll();
    await f.seedQuestions('DSA', 3);
    await f.seedQuestions('OOP', 3);
    await f.seedProblems('DSA', 3);
    await f.seedProblems('OOP', 3);
    await f.seedCompany();
  });

  const setGoal = (user, body = {}) =>
    request(app).put('/api/me/goal').set(user.auth).send({ companySlug: 'test-corp', deadlineDays: 14, hoursPerDay: 2, ...body });

  async function takeTest(user, subject, pick) {
    const { test } = (await request(app).post('/api/tests/start').set(user.auth).send({ subject, count: subject === 'DSA' ? 9 : 5 })).body;
    return f.answerTest(app, user, test, pick);
  }

  test('lists subjects and active companies without logging in', async () => {
    const subjects = await request(app).get('/api/subjects');
    expect(subjects.body.subjects.map((s) => s.key)).toEqual(['DSA', 'OOP', 'DBMS', 'SQL', 'OS', 'CN']);
    const companies = await request(app).get('/api/companies');
    expect(companies.body.companies[0]).toMatchObject({ slug: 'test-corp' });
  });

  test('onboarding stores company, deadline and hours per day', async () => {
    const user = await f.registerUser(app);
    const res = await setGoal(user);
    expect(res.status).toBe(200);
    expect(res.body.user.goal).toMatchObject({ hoursPerDay: 2 });
    expect(res.body.user.goal.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.company.slug).toBe('test-corp');
  });

  test('goal validation: unknown company, absurd values and extra fields are rejected', async () => {
    const user = await f.registerUser(app);
    expect((await setGoal(user, { companySlug: 'nope' })).status).toBe(400);
    expect((await setGoal(user, { deadlineDays: 0 })).status).toBe(400);
    expect((await setGoal(user, { deadlineDays: 4000 })).status).toBe(400);
    expect((await setGoal(user, { hoursPerDay: 20 })).status).toBe(400);
    expect((await setGoal(user, { role: 'admin' })).status).toBe(400);
  });

  test('a roadmap needs a goal and at least one test', async () => {
    const user = await f.registerUser(app);
    const noGoal = await request(app).post('/api/roadmap/generate').set(user.auth);
    expect(noGoal.status).toBe(409);
    expect(noGoal.body.error.code).toBe('goal_missing');

    await setGoal(user);
    const noTest = await request(app).post('/api/roadmap/generate').set(user.auth);
    expect(noTest.status).toBe(409);
    expect(noTest.body.error.code).toBe('no_tests');
    expect((await request(app).get('/api/roadmap').set(user.auth)).status).toBe(404);
  });

  test('generates a gap analysis and a schedule that covers every remaining day', async () => {
    const user = await f.registerUser(app);
    await setGoal(user, { deadlineDays: 14 });
    // DSA: right on the first 3 questions only; OOP untested.
    await takeTest(user, 'DSA', (q, i) => i < 3);

    const res = await request(app).post('/api/roadmap/generate').set(user.auth);
    expect(res.status).toBe(201);
    const { roadmap } = res.body;
    expect(roadmap.version).toBe(1);
    expect(roadmap.isActive).toBe(true);
    expect(roadmap.schedule).toHaveLength(14);
    expect(roadmap.schedule.map((d) => d.dayNumber)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(roadmap.goal.daysRemaining).toBe(14);

    // Test Corp: DSA high, OOP medium. DSA was tested (weaker than default after 3/9), OOP untested at 0.5.
    expect(roadmap.gaps.map((g) => g.subject).sort()).toEqual(['DSA', 'OOP']);
    roadmap.gaps.forEach((g) => expect(g.priority).toBeCloseTo(g.weightValue * (1 - g.score), 10));
    expect(roadmap.gaps[0].priority).toBeGreaterThanOrEqual(roadmap.gaps[1].priority);

    const problemTasks = roadmap.schedule.flatMap((d) => d.tasks.filter((t) => t.type === 'problem'));
    expect(problemTasks.length).toBeGreaterThan(0);
    problemTasks.forEach((t) => expect(t.url).toMatch(/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/));
    expect(new Set(problemTasks.map((t) => t.problemId)).size).toBe(problemTasks.length);
  });

  test('mastered subtopics are skipped', async () => {
    const user = await f.registerUser(app);
    await setGoal(user, { deadlineDays: 10 });
    await takeTest(user, 'DSA', () => true);
    // Push one subtopic above 80% directly.
    const Skill = require('../../src/models/Skill');
    await Skill.updateOne({ user: user.user.id, subtopic: 'arrays' }, { $set: { level: 0.9 } });

    const { roadmap } = (await request(app).post('/api/roadmap/generate').set(user.auth)).body;
    expect(roadmap.skipped.map((s) => s.subtopic)).toContain('arrays');
    expect(roadmap.schedule.some((d) => d.subtopic === 'arrays')).toBe(false);
    expect(roadmap.allocations.reduce((s, a) => s + a.days, 0)).toBe(10);
  });

  test('reschedule saves a new version, deactivates the old one and keeps history', async () => {
    const user = await f.registerUser(app);
    await setGoal(user);
    await takeTest(user, 'DSA', (q, i) => i < 2);
    await request(app).post('/api/roadmap/generate').set(user.auth);

    const second = await request(app).post('/api/roadmap/reschedule').set(user.auth);
    expect(second.status).toBe(201);
    expect(second.body.roadmap.version).toBe(2);
    expect(second.body.roadmap.reason).toBe('reschedule');

    const versions = (await request(app).get('/api/roadmap/versions').set(user.auth)).body.versions;
    expect(versions.map((v) => [v.version, v.isActive])).toEqual([[2, true], [1, false]]);
    expect((await request(app).get('/api/roadmap').set(user.auth)).body.roadmap.version).toBe(2);
    const old = await request(app).get('/api/roadmap/versions/1').set(user.auth);
    expect(old.status).toBe(200);
    expect(old.body.roadmap.version).toBe(1);
    expect((await request(app).get('/api/roadmap/versions/9').set(user.auth)).status).toBe(404);
  });

  test('a retest reschedules from the latest scores for the remaining days', async () => {
    const user = await f.registerUser(app);
    await setGoal(user, { deadlineDays: 14 });
    await takeTest(user, 'DSA', () => false);
    const first = (await request(app).post('/api/roadmap/generate').set(user.auth)).body.roadmap;

    const retest = await takeTest(user, 'DSA', () => true);
    expect(retest.status).toBe(200);
    expect(retest.body.result.roadmapVersion).toBe(2);

    const current = (await request(app).get('/api/roadmap').set(user.auth)).body.roadmap;
    expect(current.version).toBe(2);
    expect(current.reason).toBe('retest');
    const dsaBefore = first.gaps.find((g) => g.subject === 'DSA').score;
    const dsaAfter = current.gaps.find((g) => g.subject === 'DSA').score;
    expect(dsaAfter).toBeGreaterThan(dsaBefore);
  });

  test('auto reschedule can be switched off in settings', async () => {
    const user = await f.registerUser(app);
    await request(app).patch('/api/me').set(user.auth).send({ settings: { autoReschedule: false } });
    await setGoal(user);
    await takeTest(user, 'DSA', () => false);
    await request(app).post('/api/roadmap/generate').set(user.auth);
    const retest = await takeTest(user, 'DSA', () => true);
    expect(retest.body.result.roadmapVersion).toBeNull();
    expect(await Roadmap.countDocuments({ user: user.user.id })).toBe(1);
  });

  test('the plan only covers the days left: a reschedule later starts from today, not day 1', async () => {
    const user = await f.registerUser(app);
    await setGoal(user, { deadlineDays: 5 });
    await takeTest(user, 'DSA', () => false);
    const { roadmap } = (await request(app).post('/api/roadmap/generate').set(user.auth)).body;
    expect(roadmap.schedule).toHaveLength(5);
    expect(roadmap.schedule[0].date).toBe(roadmap.startDate);
  });

  test('an expired deadline cannot be planned against', async () => {
    const user = await f.registerUser(app);
    await setGoal(user);
    await takeTest(user, 'DSA', () => false);
    await User.updateOne({ _id: user.user.id }, { $set: { 'goal.deadline': '2020-01-01' } });
    const res = await request(app).post('/api/roadmap/generate').set(user.auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('deadline_passed');
  });

  test("today's plan lists today's tasks, and solving problems updates progress and the streak", async () => {
    const user = await f.registerUser(app);
    await setGoal(user);
    await takeTest(user, 'DSA', () => false);
    const { roadmap } = (await request(app).post('/api/roadmap/generate').set(user.auth)).body;

    const today = (await request(app).get('/api/roadmap/today').set(user.auth)).body.plan;
    expect(today.status).toBe('active');
    expect(today.dayNumber).toBe(1);
    const problem = today.today.tasks.find((t) => t.type === 'problem');
    expect(problem.solved).toBe(false);

    const solved = await request(app).put(`/api/roadmap/problems/${problem.problemId}/solved`).set(user.auth).send({ solved: true });
    expect(solved.status).toBe(200);
    const after = (await request(app).get('/api/roadmap').set(user.auth)).body.roadmap;
    expect(after.progressPercent).toBeGreaterThan(0);
    expect((await request(app).get('/api/roadmap/today').set(user.auth)).body.plan.today.tasks.find((t) => t.problemId === problem.problemId).solved).toBe(true);

    await request(app).put(`/api/roadmap/problems/${problem.problemId}/solved`).set(user.auth).send({ solved: false });
    expect((await request(app).get('/api/roadmap').set(user.auth)).body.roadmap.progressPercent).toBe(0);
    expect(roadmap.version).toBe(1);
  });

  test('solved problems are not scheduled again on a reschedule', async () => {
    const user = await f.registerUser(app);
    await setGoal(user);
    await takeTest(user, 'DSA', () => false);
    const first = (await request(app).post('/api/roadmap/generate').set(user.auth)).body.roadmap;
    const firstProblems = first.schedule.flatMap((d) => d.tasks.filter((t) => t.type === 'problem')).slice(0, 3);
    for (const p of firstProblems) {
      await request(app).put(`/api/roadmap/problems/${p.problemId}/solved`).set(user.auth).send({ solved: true });
    }
    const second = (await request(app).post('/api/roadmap/reschedule').set(user.auth)).body.roadmap;
    const ids = new Set(second.schedule.flatMap((d) => d.tasks.map((t) => t.problemId)));
    firstProblems.forEach((p) => expect(ids.has(p.problemId)).toBe(false));
  });

  test("one student cannot see or change another student's roadmap progress", async () => {
    const a = await f.registerUser(app);
    const b = await f.registerUser(app);
    await setGoal(a);
    await takeTest(a, 'DSA', () => false);
    await request(app).post('/api/roadmap/generate').set(a.auth);
    expect((await request(app).get('/api/roadmap').set(b.auth)).status).toBe(404);
  });

  test('progress endpoint shows score history and improvement since the first test', async () => {
    const user = await f.registerUser(app);
    await takeTest(user, 'DSA', () => false);
    await takeTest(user, 'DSA', () => true);
    const res = await request(app).get('/api/progress').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.totalTests).toBe(2);
    expect(res.body.subjects.DSA.tests).toBe(2);
    expect(res.body.subjects.DSA.firstScore).toBe(0);
    expect(res.body.subjects.DSA.latestScore).toBe(1);
    expect(res.body.subjects.DSA.improvement).toBe(1);
    expect(res.body.subjects.DSA.subtopics.length).toBe(9);
  });

  test('skills and dashboard endpoints summarise levels, streak and days left', async () => {
    const user = await f.registerUser(app);
    await setGoal(user, { deadlineDays: 30 });
    await takeTest(user, 'DSA', () => true);
    const skills = await request(app).get('/api/skills').set(user.auth);
    const dsa = skills.body.subjects.find((s) => s.subject === 'DSA');
    expect(dsa.score).toBeCloseTo(0.65, 10);
    expect(skills.body.subjects.find((s) => s.subject === 'OOP').score).toBeCloseTo(0.5, 10);

    const dash = await request(app).get('/api/me/dashboard').set(user.auth);
    expect(dash.status).toBe(200);
    expect(dash.body.daysLeft).toBe(30);
    expect(dash.body.streak.current).toBe(1);
    expect(dash.body.company.slug).toBe('test-corp');
    expect(dash.body.subjects).toHaveLength(6);
    expect(dash.body.roadmap).toBeNull();
  });

  test('profile updates validate the timezone', async () => {
    const user = await f.registerUser(app);
    expect((await request(app).patch('/api/me').set(user.auth).send({ timezone: 'Mars/Base' })).status).toBe(400);
    const ok = await request(app).patch('/api/me').set(user.auth).send({ name: 'New Name', timezone: 'Asia/Kolkata' });
    expect(ok.body.user.name).toBe('New Name');
    expect((await request(app).patch('/api/me').set(user.auth).send({ role: 'admin' })).status).toBe(400);
  });

  describe('resources, practicals and quizzes', () => {
    beforeEach(async () => {
      await f.seedStudyItems('DSA');
      await f.seedStudyItems('OOP', { practicals: true });
    });

    async function planned(user) {
      await setGoal(user, { deadlineDays: 10, hoursPerDay: 3 });
      await takeTest(user, 'DSA', (q, i) => i < 3);
      return (await request(app).post('/api/roadmap/generate').set(user.auth)).body.roadmap;
    }

    test('the plan carries resources, practicals for OOP and a quiz at the end of each block', async () => {
      const user = await f.registerUser(app);
      const roadmap = await planned(user);
      const tasks = roadmap.schedule.flatMap((d) => d.tasks);
      expect(tasks.filter((t) => t.type === 'resource').every((t) => t.itemId && t.url.startsWith('https://example.com/'))).toBe(true);
      expect(tasks.some((t) => t.type === 'resource')).toBe(true);
      expect(tasks.filter((t) => t.type === 'practical').every((t) => t.itemId && t.description)).toBe(true);
      expect(tasks.some((t) => t.type === 'practical')).toBe(true);

      const quizzes = tasks.filter((t) => t.type === 'quiz');
      expect(quizzes).toHaveLength(roadmap.allocations.length);
      quizzes.forEach((q) => expect(q).toMatchObject({ questionCount: 5 }));
      expect(roadmap.schedule.every((d) => d.tasks.length > 0)).toBe(true);
    });

    test('ticking a resource moves progress and shows as done in the daily plan', async () => {
      const user = await f.registerUser(app);
      await planned(user);
      const today = (await request(app).get('/api/roadmap/today').set(user.auth)).body.plan;
      const resource = today.today.tasks.find((t) => t.type === 'resource');
      expect(resource.solved).toBe(false);

      const done = await request(app).put(`/api/roadmap/items/${resource.itemId}/done`).set(user.auth).send({ done: true });
      expect(done.status).toBe(200);
      const after = (await request(app).get('/api/roadmap').set(user.auth)).body.roadmap;
      expect(after.progressPercent).toBeGreaterThan(0);
      expect(after.doneIds).toContain(resource.itemId);
      expect((await request(app).get('/api/roadmap/today').set(user.auth)).body.plan.today.tasks.find((t) => t.itemId === resource.itemId).solved).toBe(true);

      await request(app).put(`/api/roadmap/items/${resource.itemId}/done`).set(user.auth).send({ done: false });
      expect((await request(app).get('/api/roadmap').set(user.auth)).body.roadmap.doneIds).not.toContain(resource.itemId);
    });

    test('item routes validate the id and the body', async () => {
      const user = await f.registerUser(app);
      expect((await request(app).put('/api/roadmap/items/nope/done').set(user.auth).send({ done: true })).status).toBe(400);
      const missing = '64b64b64b64b64b64b64b64b';
      expect((await request(app).put(`/api/roadmap/items/${missing}/done`).set(user.auth).send({ done: true })).status).toBe(404);
      const item = await StudyItem.findOne();
      expect((await request(app).put(`/api/roadmap/items/${item._id}/done`).set(user.auth).send({ done: 'yes' })).status).toBe(400);
      expect((await request(app).put(`/api/roadmap/items/${item._id}/done`).send({ done: true })).status).toBe(401);
    });

    test('finishing the quiz task marks it done, and does not replace the roadmap', async () => {
      const user = await f.registerUser(app);
      const roadmap = await planned(user);
      const quiz = roadmap.schedule.flatMap((d) => d.tasks).find((t) => t.type === 'quiz');

      const started = await request(app).post('/api/tests/start').set(user.auth).send({ subject: quiz.subject, subtopic: quiz.subtopic, count: quiz.questionCount });
      expect(started.status).toBe(201);
      expect(started.body.test.focusSubtopic).toBe(quiz.subtopic);
      expect(started.body.test.questions).toHaveLength(5);

      const submitted = await f.answerTest(app, user, started.body.test);
      expect(submitted.status).toBe(200);
      expect(submitted.body.result.focusSubtopic).toBe(quiz.subtopic);
      expect(submitted.body.result.roadmapVersion).toBeNull();
      expect(submitted.body.result.subtopics).toHaveLength(1);

      const after = (await request(app).get('/api/roadmap').set(user.auth)).body.roadmap;
      expect(after.version).toBe(1);
      expect(after.doneIds).toContain(`quiz:${quiz.subject}:${quiz.subtopic}`);
    });

    test('a quiz taken before the roadmap existed does not count for it', async () => {
      const user = await f.registerUser(app);
      await setGoal(user, { deadlineDays: 10, hoursPerDay: 3 });
      await takeTest(user, 'DSA', (q, i) => i < 3);
      const early = await request(app).post('/api/tests/start').set(user.auth).send({ subject: 'DSA', subtopic: 'arrays', count: 5 });
      await f.answerTest(app, user, early.body.test);
      const roadmap = (await request(app).post('/api/roadmap/generate').set(user.auth)).body.roadmap;
      expect(roadmap.doneIds.filter((id) => id.startsWith('quiz:'))).toEqual([]);
    });

    test('a finished practical is not set again after a reschedule', async () => {
      const user = await f.registerUser(app);
      const roadmap = await planned(user);
      const practical = roadmap.schedule.flatMap((d) => d.tasks).find((t) => t.type === 'practical');
      await request(app).put(`/api/roadmap/items/${practical.itemId}/done`).set(user.auth).send({ done: true });

      const next = (await request(app).post('/api/roadmap/reschedule').set(user.auth)).body.roadmap;
      expect(next.schedule.flatMap((d) => d.tasks).some((t) => t.itemId === practical.itemId)).toBe(false);
    });

    test('theory subjects without problems get no LeetCode tasks of their own', async () => {
      const Company = require('../../src/models/Company');
      await Company.updateOne({ slug: 'test-corp' }, { $set: { skills: [{ subject: 'DSA', weight: 'high' }, { subject: 'DBMS', weight: 'high' }] } });
      await f.seedQuestions('DBMS', 2);
      await f.seedStudyItems('DBMS', { practicals: true });
      const user = await f.registerUser(app);
      await setGoal(user, { deadlineDays: 12, hoursPerDay: 3 });
      await takeTest(user, 'DSA', (q, i) => i < 3);
      const roadmap = (await request(app).post('/api/roadmap/generate').set(user.auth)).body.roadmap;
      const dbmsDays = roadmap.schedule.filter((d) => d.subject === 'DBMS');
      expect(dbmsDays.length).toBeGreaterThan(0);
      dbmsDays.forEach((d) => d.tasks.filter((t) => t.type === 'problem').forEach((t) => expect(t.warmup).toBe(true)));
    });
  });
});
