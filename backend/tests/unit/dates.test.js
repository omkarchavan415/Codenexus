'use strict';

const { dayKey, dayDiff, updateStreak, activeStreak } = require('../../src/utils/dates');

describe('dayKey', () => {
  test('uses the student timezone, not UTC', () => {
    const instant = new Date('2026-10-10T20:00:00Z'); // 01:30 on the 11th in India
    expect(dayKey(instant, 'Asia/Kolkata')).toBe('2026-10-11');
    expect(dayKey(instant, 'UTC')).toBe('2026-10-10');
  });

  test('falls back for an unknown timezone instead of throwing', () => {
    expect(dayKey(new Date('2026-10-10T00:00:00Z'), 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dayDiff', () => {
  test('counts calendar days', () => {
    expect(dayDiff('2026-10-10', '2026-10-13')).toBe(3);
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('updateStreak', () => {
  const at = (iso) => new Date(iso);

  test('the first activity starts a streak of 1', () => {
    expect(updateStreak(undefined, at('2026-10-10T06:00:00Z'), 'UTC')).toEqual({ current: 1, longest: 1, lastActiveDay: '2026-10-10' });
  });

  test('more activity on the same day does not extend it', () => {
    const s = updateStreak({ current: 3, longest: 3, lastActiveDay: '2026-10-10' }, at('2026-10-10T20:00:00Z'), 'UTC');
    expect(s.current).toBe(3);
  });

  test('activity on the next day extends it and tracks the longest', () => {
    const s = updateStreak({ current: 3, longest: 3, lastActiveDay: '2026-10-10' }, at('2026-10-11T08:00:00Z'), 'UTC');
    expect(s).toEqual({ current: 4, longest: 4, lastActiveDay: '2026-10-11' });
  });

  test('a missed day restarts the streak but keeps the longest', () => {
    const s = updateStreak({ current: 5, longest: 5, lastActiveDay: '2026-10-10' }, at('2026-10-12T08:00:00Z'), 'UTC');
    expect(s).toEqual({ current: 1, longest: 5, lastActiveDay: '2026-10-12' });
  });
});

describe('activeStreak', () => {
  const streak = { current: 4, longest: 6, lastActiveDay: '2026-10-10' };
  test('still alive today and tomorrow, gone after a missed day', () => {
    expect(activeStreak(streak, new Date('2026-10-10T10:00:00Z'), 'UTC')).toBe(4);
    expect(activeStreak(streak, new Date('2026-10-11T10:00:00Z'), 'UTC')).toBe(4);
    expect(activeStreak(streak, new Date('2026-10-12T10:00:00Z'), 'UTC')).toBe(0);
  });
  test('no activity yet is 0', () => {
    expect(activeStreak({}, new Date(), 'UTC')).toBe(0);
  });
});
