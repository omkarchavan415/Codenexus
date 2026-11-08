'use strict';

const { updateLevel, difficultyForLevel, subjectScore, isMastered, DEFAULT_LEVEL } = require('../../src/services/skill');

describe('updateLevel: level += 0.3 * (score - level)', () => {
  test('moves 30% of the way towards the score', () => {
    expect(updateLevel(0.5, 1)).toBeCloseTo(0.65, 10);
    expect(updateLevel(0.5, 0)).toBeCloseTo(0.35, 10);
    expect(updateLevel(0.2, 0.8)).toBeCloseTo(0.38, 10);
  });

  test('a score equal to the level changes nothing', () => {
    expect(updateLevel(0.6, 0.6)).toBeCloseTo(0.6, 10);
  });

  test('repeated perfect scores approach but never exceed 1', () => {
    let level = 0.5;
    for (let i = 0; i < 50; i += 1) level = updateLevel(level, 1);
    expect(level).toBeGreaterThan(0.99);
    expect(level).toBeLessThanOrEqual(1);
  });

  test('stays inside [0, 1] even with out-of-range inputs', () => {
    expect(updateLevel(1.4, 1)).toBeLessThanOrEqual(1);
    expect(updateLevel(-0.2, 0)).toBeGreaterThanOrEqual(0);
    expect(updateLevel(0.5, 7)).toBeLessThanOrEqual(1);
  });

  test('falls back to the default level when the old level is missing', () => {
    expect(updateLevel(undefined, 1)).toBeCloseTo(DEFAULT_LEVEL + 0.3 * (1 - DEFAULT_LEVEL), 10);
  });
});

describe('difficultyForLevel', () => {
  test.each([
    [0, 'easy'],
    [0.39, 'easy'],
    [0.4, 'medium'],
    [0.69, 'medium'],
    [0.7, 'hard'],
    [1, 'hard'],
  ])('level %p -> %p', (level, expected) => {
    expect(difficultyForLevel(level)).toBe(expected);
  });

  test('an unknown level is treated as the default (medium)', () => {
    expect(difficultyForLevel(undefined)).toBe('medium');
  });
});

describe('subjectScore', () => {
  test('averages subtopic levels, counting untested subtopics at the default', () => {
    expect(subjectScore({ a: 1, b: 0 }, ['a', 'b'])).toBeCloseTo(0.5, 10);
    expect(subjectScore({ a: 1 }, ['a', 'b'])).toBeCloseTo((1 + DEFAULT_LEVEL) / 2, 10);
  });
});

describe('isMastered', () => {
  test('80% and above is mastered', () => {
    expect(isMastered(0.8)).toBe(true);
    expect(isMastered(0.79)).toBe(false);
  });
});
