'use strict';

const { allocateDays, buildPlan, addDays } = require('../../src/services/planner');

const sub = (subject, subtopic, level, weightValue = 3) => ({
  subject,
  subtopic,
  label: subtopic,
  level,
  priority: weightValue * (1 - level),
});

const problems = [];
['arrays', 'trees', 'graphs', 'joins'].forEach((subtopic) => {
  const subject = subtopic === 'joins' ? 'SQL' : 'DSA';
  ['easy', 'medium', 'hard'].forEach((difficulty) => {
    for (let i = 1; i <= 4; i += 1) {
      problems.push({ id: `${subtopic}-${difficulty}-${i}`, title: `${subtopic} ${difficulty} ${i}`, url: `https://leetcode.com/problems/${subtopic}-${difficulty}-${i}/`, subject, subtopic, difficulty });
    }
  });
});

describe('addDays', () => {
  test('adds calendar days without timezone drift', () => {
    expect(addDays('2026-10-10', 0)).toBe('2026-10-10');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('allocateDays', () => {
  test('splits days in proportion to priority and uses every day', () => {
    const items = [{ priority: 3 }, { priority: 1 }];
    const out = allocateDays(items, 8);
    expect(out.map((o) => o.days)).toEqual([6, 2]);
  });

  test('always totals exactly the available days', () => {
    const items = [{ priority: 2.4 }, { priority: 1.5 }, { priority: 0.9 }, { priority: 0.3 }];
    for (const days of [4, 5, 7, 13, 30, 61]) {
      const out = allocateDays(items, days);
      expect(out.reduce((s, o) => s + o.days, 0)).toBe(days);
      out.forEach((o) => expect(o.days).toBeGreaterThanOrEqual(1));
    }
  });

  test('keeps only the highest-priority items when there are fewer days than items', () => {
    const items = [{ priority: 3, id: 'a' }, { priority: 2, id: 'b' }, { priority: 1, id: 'c' }];
    const out = allocateDays(items, 2);
    expect(out.map((o) => o.item.id)).toEqual(['a', 'b']);
    expect(out.map((o) => o.days)).toEqual([1, 1]);
  });

  test('a low-priority item still gets its minimum day', () => {
    const out = allocateDays([{ priority: 10 }, { priority: 0.01 }], 5);
    expect(out[1].days).toBe(1);
    expect(out[0].days).toBe(4);
  });
});

describe('buildPlan', () => {
  const base = { hoursPerDay: 2, startDate: '2026-10-10', problems };

  test('splits the remaining days across weak subtopics by priority and orders biggest first', () => {
    const plan = buildPlan({
      ...base,
      days: 10,
      subtopics: [sub('DSA', 'arrays', 0.6), sub('DSA', 'trees', 0.2), sub('DSA', 'graphs', 0.4)],
    });
    expect(plan.schedule).toHaveLength(10);
    expect(plan.allocations.map((a) => a.subtopic)).toEqual(['trees', 'graphs', 'arrays']);
    const days = plan.allocations.map((a) => a.days);
    expect(days.reduce((s, d) => s + d, 0)).toBe(10);
    expect(days[0]).toBeGreaterThan(days[1]);
    expect(days[1]).toBeGreaterThanOrEqual(days[2]);
  });

  test('skips mastered subtopics (>= 80%) and reports them', () => {
    const plan = buildPlan({
      ...base,
      days: 6,
      subtopics: [sub('DSA', 'arrays', 0.85), sub('DSA', 'trees', 0.3)],
    });
    expect(plan.allocations.map((a) => a.subtopic)).toEqual(['trees']);
    expect(plan.skipped.map((s) => s.subtopic)).toEqual(['arrays']);
    expect(plan.schedule.every((d) => d.subtopic === 'trees')).toBe(true);
    expect(plan.schedule).toHaveLength(6);
  });

  test('everything mastered gives an empty plan flagged as mastered', () => {
    const plan = buildPlan({ ...base, days: 5, subtopics: [sub('DSA', 'arrays', 0.9)] });
    expect(plan.mastered).toBe(true);
    expect(plan.schedule).toEqual([]);
  });

  test('dates run consecutively from the start date and day numbers are sequential', () => {
    const plan = buildPlan({ ...base, days: 4, subtopics: [sub('DSA', 'trees', 0.3), sub('DSA', 'graphs', 0.3)] });
    expect(plan.schedule.map((d) => d.dayNumber)).toEqual([1, 2, 3, 4]);
    expect(plan.schedule.map((d) => d.date)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']);
  });

  test('attaches problems that match the subtopic, and never repeats one', () => {
    const plan = buildPlan({ ...base, days: 8, subtopics: [sub('DSA', 'trees', 0.3), sub('SQL', 'joins', 0.3)] });
    const tasks = plan.schedule.flatMap((d) => d.tasks.filter((t) => t.type === 'problem'));
    expect(tasks.length).toBeGreaterThan(0);
    const ids = tasks.map((t) => t.problemId);
    expect(new Set(ids).size).toBe(ids.length);
    plan.schedule.forEach((d) => {
      d.tasks
        .filter((t) => t.problemId && !t.warmup)
        .forEach((t) => expect(t.problemId.startsWith(d.subtopic)).toBe(true));
    });
  });

  test('problem difficulty follows the skill level: low -> easy first, high -> hard first', () => {
    const low = buildPlan({ ...base, days: 1, subtopics: [sub('DSA', 'trees', 0.1)] });
    const high = buildPlan({ ...base, days: 1, subtopics: [sub('DSA', 'trees', 0.75)] });
    const firstProblem = (p) => p.schedule[0].tasks.find((t) => t.type === 'problem');
    expect(firstProblem(low).difficulty).toBe('easy');
    expect(firstProblem(high).difficulty).toBe('hard');
  });

  test('a day never plans more minutes than the student has', () => {
    const plan = buildPlan({ ...base, hoursPerDay: 1, days: 6, subtopics: [sub('DSA', 'trees', 0.3), sub('DSA', 'graphs', 0.5)] });
    plan.schedule.forEach((d) => {
      const minutes = d.tasks.reduce((s, t) => s + t.minutes, 0);
      // One problem may overshoot a little, but a day must not be wildly over budget.
      expect(minutes).toBeLessThanOrEqual(60 + 50);
    });
  });

  test('without study items the first day of a block starts with a study task and the last day ends with a quiz', () => {
    const plan = buildPlan({ ...base, days: 3, subtopics: [sub('DSA', 'trees', 0.3)] });
    expect(plan.schedule[0].tasks[0].type).toBe('study');
    const last = plan.schedule[2].tasks;
    expect(last[last.length - 1]).toMatchObject({ type: 'quiz', subject: 'DSA', subtopic: 'trees', questionCount: 5 });
  });

  test('with nothing to assign the middle day falls back to a review task instead of being empty', () => {
    const plan = buildPlan({ ...base, problems: [], days: 3, subtopics: [sub('DSA', 'trees', 0.3)] });
    plan.schedule.forEach((d) => expect(d.tasks.length).toBeGreaterThan(0));
    expect(plan.schedule[1].tasks[0].type).toBe('review');
  });

  test('task ids are unique within a day', () => {
    const plan = buildPlan({ ...base, days: 3, subtopics: [sub('DSA', 'trees', 0.3)] });
    plan.schedule.forEach((d) => {
      const ids = d.tasks.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  test('a short deadline keeps only the weakest subtopics', () => {
    const plan = buildPlan({
      ...base,
      days: 2,
      subtopics: [sub('DSA', 'arrays', 0.7), sub('DSA', 'trees', 0.1), sub('DSA', 'graphs', 0.3)],
    });
    expect(plan.allocations.map((a) => a.subtopic)).toEqual(['trees', 'graphs']);
  });
});


describe('buildPlan with resources, practicals, quizzes and warm-ups', () => {
  const items = [];
  [['DBMS', 'normalization'], ['DSA', 'trees'], ['DSA', 'graphs']].forEach(([subject, subtopic]) => {
    items.push({ id: `${subtopic}-r1`, type: 'resource', subject, subtopic, title: `Read ${subtopic}`, url: 'https://example.com/a', minutes: 20, description: '' });
    items.push({ id: `${subtopic}-r2`, type: 'resource', subject, subtopic, title: `Watch ${subtopic}`, url: 'https://example.com/b', minutes: 30, description: '' });
  });
  items.push({ id: 'norm-p1', type: 'practical', subject: 'DBMS', subtopic: 'normalization', title: 'Normalise a table', description: 'Do it', minutes: 30 });
  items.push({ id: 'norm-p2', type: 'practical', subject: 'DBMS', subtopic: 'normalization', title: 'Another', description: 'Do it too', minutes: 30 });

  const base = { hoursPerDay: 2, startDate: '2026-10-10', problems, items };
  const dbms = (level = 0.3) => ({ ...sub('DBMS', 'normalization', level), label: 'Normalization' });

  test('a subtopic without problems gets resources, a practical and a quiz, and no LeetCode problem of its own', () => {
    const plan = buildPlan({ ...base, days: 3, subtopics: [dbms(), sub('DSA', 'trees', 0.5, 0.1)] });
    const day = plan.schedule.filter((d) => d.subtopic === 'normalization');
    const tasks = day.flatMap((d) => d.tasks);
    expect(tasks.filter((t) => t.type === 'resource').length).toBeGreaterThan(0);
    expect(tasks.filter((t) => t.type === 'practical').length).toBeGreaterThan(0);
    expect(tasks.filter((t) => t.type === 'quiz')).toHaveLength(1);
    expect(tasks.filter((t) => t.problemId && !t.warmup)).toHaveLength(0);
    expect(tasks.find((t) => t.type === 'resource').itemId).toBe('normalization-r1');
  });

  test('the quiz is the last task of the last day of the block only', () => {
    const plan = buildPlan({ ...base, days: 4, subtopics: [dbms(), sub('DSA', 'trees', 0.5, 0.1)] });
    plan.allocations.forEach((a) => {
      const block = plan.schedule.filter((d) => d.subtopic === a.subtopic);
      block.forEach((d, i) => {
        const hasQuiz = d.tasks.some((t) => t.type === 'quiz');
        expect(hasQuiz).toBe(i === block.length - 1);
        if (hasQuiz) expect(d.tasks[d.tasks.length - 1].type).toBe('quiz');
      });
    });
  });

  test('resources spread over the block and never exceed 45% of a day', () => {
    const plan = buildPlan({ ...base, hoursPerDay: 2, days: 3, subtopics: [dbms()] });
    const seen = [];
    plan.schedule.forEach((d) => {
      const reading = d.tasks.filter((t) => t.type === 'resource');
      reading.forEach((t) => seen.push(t.itemId));
      const minutes = reading.reduce((s, t) => s + t.minutes, 0);
      expect(minutes).toBeLessThanOrEqual(Math.round(120 * 0.45));
    });
    expect(seen).toEqual(['normalization-r1', 'normalization-r2']);
  });

  test('days of a non-DSA topic carry one DSA warm-up problem from the weakest DSA subtopic', () => {
    const plan = buildPlan({ ...base, days: 4, subtopics: [{ ...dbms(0.2), priority: 3 }, sub('DSA', 'trees', 0.1, 3), sub('DSA', 'graphs', 0.6, 1)] });
    const dbmsDays = plan.schedule.filter((d) => d.subject === 'DBMS');
    expect(dbmsDays.length).toBeGreaterThan(0);
    dbmsDays.forEach((d) => {
      const warm = d.tasks.filter((t) => t.warmup);
      expect(warm).toHaveLength(1);
      expect(warm[0].problemId.startsWith('trees')).toBe(true);
    });
    const all = plan.schedule.flatMap((d) => d.tasks.filter((t) => t.problemId).map((t) => t.problemId));
    expect(new Set(all).size).toBe(all.length);
  });

  test('DSA days get no extra warm-up', () => {
    const plan = buildPlan({ ...base, days: 3, subtopics: [sub('DSA', 'trees', 0.2)] });
    expect(plan.schedule.flatMap((d) => d.tasks).filter((t) => t.warmup)).toHaveLength(0);
  });

  test('short days skip the warm-up so the main topic is not squeezed out', () => {
    const plan = buildPlan({ ...base, hoursPerDay: 1, days: 3, subtopics: [dbms(0.2), sub('DSA', 'trees', 0.1, 3)] });
    expect(plan.schedule.filter((d) => d.subject === 'DBMS').flatMap((d) => d.tasks).filter((t) => t.warmup)).toHaveLength(0);
  });

  test('no warm-up when DSA is mastered or not part of the plan', () => {
    const plan = buildPlan({ ...base, days: 3, subtopics: [dbms(0.2), sub('DSA', 'trees', 0.9)] });
    expect(plan.schedule.flatMap((d) => d.tasks).filter((t) => t.warmup)).toHaveLength(0);
  });

  test('a day stays near the available time even with resources, a practical, a warm-up and a quiz', () => {
    const plan = buildPlan({ ...base, hoursPerDay: 2, days: 4, subtopics: [dbms(0.2), sub('DSA', 'trees', 0.1, 3)] });
    plan.schedule.forEach((d) => {
      expect(d.tasks.reduce((s, t) => s + t.minutes, 0)).toBeLessThanOrEqual(120 + 35);
    });
  });

  test('task ids stay unique and sequential within a day', () => {
    const plan = buildPlan({ ...base, days: 4, subtopics: [dbms(0.2), sub('DSA', 'trees', 0.1, 3)] });
    plan.schedule.forEach((d) => expect(d.tasks.map((t) => t.id)).toEqual(d.tasks.map((_, i) => `d${d.dayNumber}-t${i + 1}`)));
  });

  test('a subtopic with no items still gets a study task and a quiz', () => {
    const plan = buildPlan({ hoursPerDay: 2, startDate: '2026-10-10', problems, items: [], days: 2, subtopics: [dbms()] });
    expect(plan.schedule[0].tasks[0].type).toBe('study');
    expect(plan.schedule[1].tasks.some((t) => t.type === 'quiz')).toBe(true);
  });
});
