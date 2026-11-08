'use strict';

const { analyzeGaps, gapPriority, subtopicPriorities, weightValue } = require('../../src/services/gap');

describe('gap priority = weight x (1 - score)', () => {
  test('weights are high 3, medium 2, low 1', () => {
    expect(weightValue('high')).toBe(3);
    expect(weightValue('medium')).toBe(2);
    expect(weightValue('low')).toBe(1);
  });

  test('the formula', () => {
    expect(gapPriority('high', 0.4)).toBeCloseTo(1.8, 10);
    expect(gapPriority('medium', 0.3)).toBeCloseTo(1.4, 10);
    expect(gapPriority('low', 0.8)).toBeCloseTo(0.2, 10);
  });
});

describe('analyzeGaps', () => {
  const requirements = [
    { subject: 'DSA', weight: 'high' },
    { subject: 'OOP', weight: 'high' },
    { subject: 'DBMS', weight: 'medium' },
    { subject: 'SQL', weight: 'medium' },
  ];
  const subjectScores = { DSA: 0.4, OOP: 0.8, DBMS: 0.65, SQL: 0.3, OS: 0.1 };

  test('ranks subjects by priority, biggest gap first', () => {
    const gaps = analyzeGaps({ requirements, subjectScores });
    expect(gaps.map((g) => g.subject)).toEqual(['DSA', 'SQL', 'DBMS', 'OOP']);
    expect(gaps[0].priority).toBeCloseTo(1.8, 10);
    expect(gaps[1].priority).toBeCloseTo(1.4, 10);
    expect(gaps[2].priority).toBeCloseTo(0.7, 10);
    expect(gaps[3].priority).toBeCloseTo(0.6, 10);
  });

  test('subjects outside the company profile are ignored (OS here)', () => {
    const gaps = analyzeGaps({ requirements, subjectScores });
    expect(gaps.find((g) => g.subject === 'OS')).toBeUndefined();
  });

  test('the same score matters more under a higher requirement weight', () => {
    const gaps = analyzeGaps({
      requirements: [
        { subject: 'DSA', weight: 'low' },
        { subject: 'SQL', weight: 'high' },
      ],
      subjectScores: { DSA: 0.5, SQL: 0.5 },
    });
    expect(gaps[0].subject).toBe('SQL');
  });

  test('labels severity, and mastered subjects are marked', () => {
    const gaps = analyzeGaps({ requirements, subjectScores });
    const bySubject = Object.fromEntries(gaps.map((g) => [g.subject, g.severity]));
    expect(bySubject.DSA).toBe('high');
    expect(bySubject.SQL).toBe('medium');
    expect(bySubject.DBMS).toBe('low');
    expect(bySubject.OOP).toBe('mastered');
  });

  test('an untested subject is scored at the default level instead of being dropped', () => {
    const gaps = analyzeGaps({ requirements: [{ subject: 'CN', weight: 'high' }], subjectScores: {} });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].score).toBe(0.5);
  });
});

describe('subtopicPriorities', () => {
  test('applies the subject weight to each subtopic level', () => {
    const gaps = analyzeGaps({ requirements: [{ subject: 'DSA', weight: 'high' }], subjectScores: { DSA: 0.5 } });
    const out = subtopicPriorities({
      gaps,
      subtopicKeysBySubject: { DSA: ['arrays', 'trees', 'graphs'] },
      subtopicLevels: { DSA: { arrays: 0.9, trees: 0.2 } },
    });
    expect(out.map((s) => s.subtopic)).toEqual(['trees', 'graphs', 'arrays']);
    expect(out[0].priority).toBeCloseTo(2.4, 10);
    expect(out[1].priority).toBeCloseTo(1.5, 10);
    expect(out[2].priority).toBeCloseTo(0.3, 10);
  });
});
