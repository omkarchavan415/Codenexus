'use strict';

const { computeDailyPlan, dayIndex, progressPercent } = require('../../src/services/dailyPlan');

const schedule = [
  { dayNumber: 1, date: '2026-10-10', subject: 'DSA', subtopic: 'trees', label: 'Trees', tasks: [{ id: 'd1-t1', type: 'study', minutes: 40 }, { id: 'd1-t2', type: 'problem', problemId: 'p1', minutes: 35 }] },
  { dayNumber: 2, date: '2026-10-11', subject: 'DSA', subtopic: 'trees', label: 'Trees', tasks: [{ id: 'd2-t1', type: 'problem', problemId: 'p2', minutes: 35 }] },
  { dayNumber: 3, date: '2026-10-12', subject: 'DSA', subtopic: 'graphs', label: 'Graphs', tasks: [{ id: 'd3-t1', type: 'problem', problemId: 'p3', minutes: 35 }] },
  { dayNumber: 4, date: '2026-10-13', subject: 'DSA', subtopic: 'graphs', label: 'Graphs', tasks: [{ id: 'd4-t1', type: 'problem', problemId: 'p4', minutes: 35 }] },
];
const startDate = '2026-10-10';

describe('dayIndex', () => {
  test('day 1 is the start date', () => {
    expect(dayIndex(startDate, '2026-10-10')).toBe(1);
    expect(dayIndex(startDate, '2026-10-12')).toBe(3);
    expect(dayIndex(startDate, '2026-10-09')).toBe(0);
  });
});

describe('computeDailyPlan', () => {
  test("returns today's tasks with solved flags", () => {
    const plan = computeDailyPlan({ schedule, startDate, today: '2026-10-10', solved: new Set(['p1']) });
    expect(plan.status).toBe('active');
    expect(plan.dayNumber).toBe(1);
    expect(plan.today.tasks.find((t) => t.problemId === 'p1').solved).toBe(true);
    expect(plan.overdue).toEqual([]);
    expect(plan.behindDays).toBe(0);
  });

  test('earlier days with unsolved problems are overdue', () => {
    const plan = computeDailyPlan({ schedule, startDate, today: '2026-10-12', solved: new Set(['p1']) });
    expect(plan.dayNumber).toBe(3);
    expect(plan.overdue.map((d) => d.dayNumber)).toEqual([2]);
    expect(plan.overdue[0].tasks.map((t) => t.problemId)).toEqual(['p2']);
    expect(plan.behindDays).toBe(1);
    expect(plan.rescheduleRecommended).toBe(false);
  });

  test('two or more overdue days recommend a reschedule', () => {
    const plan = computeDailyPlan({ schedule, startDate, today: '2026-10-13', solved: new Set() });
    expect(plan.behindDays).toBe(3);
    expect(plan.rescheduleRecommended).toBe(true);
  });

  test('a past day whose problems are all solved is not overdue', () => {
    const plan = computeDailyPlan({ schedule, startDate, today: '2026-10-11', solved: new Set(['p1']) });
    expect(plan.overdue).toEqual([]);
  });

  test('before the start date the plan is upcoming and has nothing for today', () => {
    const plan = computeDailyPlan({ schedule, startDate, today: '2026-10-08', solved: new Set() });
    expect(plan.status).toBe('upcoming');
    expect(plan.today).toBeNull();
  });

  test('after the last day the plan is finished and leftovers are overdue', () => {
    const plan = computeDailyPlan({ schedule, startDate, today: '2026-10-20', solved: new Set(['p1', 'p2']) });
    expect(plan.status).toBe('finished');
    expect(plan.today).toBeNull();
    expect(plan.overdue.map((d) => d.dayNumber)).toEqual([3, 4]);
    expect(plan.rescheduleRecommended).toBe(true);
  });

  test('an empty schedule is reported as empty', () => {
    expect(computeDailyPlan({ schedule: [], startDate, today: '2026-10-10', solved: new Set() }).status).toBe('empty');
  });
});

describe('progressPercent', () => {
  test('share of problems solved', () => {
    expect(progressPercent(schedule, new Set(['p1', 'p2']))).toBe(50);
    expect(progressPercent(schedule, new Set())).toBe(0);
    expect(progressPercent([], new Set())).toBe(0);
  });
});
