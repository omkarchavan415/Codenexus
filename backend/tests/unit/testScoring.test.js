'use strict';

const { distribute, scoreAttempt } = require('../../src/services/testService');
const { buildProgress } = require('../../src/services/progressService');
const { updateLevel } = require('../../src/services/skill');

describe('distribute', () => {
  test('spreads questions evenly and gives the remainder to the weakest subtopics', () => {
    const out = distribute(10, ['a', 'b', 'c'], { a: 0.9, b: 0.1, c: 0.5 });
    const byKey = Object.fromEntries(out.map((o) => [o.key, o.n]));
    expect(byKey).toEqual({ b: 4, c: 3, a: 3 });
    expect(out.reduce((s, o) => s + o.n, 0)).toBe(10);
  });

  test('with fewer questions than subtopics only the weakest are tested', () => {
    const out = distribute(2, ['a', 'b', 'c'], { a: 0.9, b: 0.1, c: 0.5 });
    expect(out.map((o) => o.key)).toEqual(['b', 'c']);
    expect(out.every((o) => o.n === 1)).toBe(true);
  });
});

describe('scoreAttempt', () => {
  const attemptQuestions = [
    { question: 'q1', subtopic: 'trees', difficulty: 'easy' },
    { question: 'q2', subtopic: 'trees', difficulty: 'medium' },
    { question: 'q3', subtopic: 'graphs', difficulty: 'medium' },
    { question: 'q4', subtopic: 'graphs', difficulty: 'hard' },
  ];
  const answerKey = new Map([['q1', 0], ['q2', 1], ['q3', 2], ['q4', 3]]);

  test('marks answers, treats unanswered as wrong, and scores per subtopic', () => {
    const out = scoreAttempt({
      attemptQuestions,
      answerKey,
      answers: [
        { questionId: 'q1', selectedIndex: 0 },
        { questionId: 'q2', selectedIndex: 3 },
        { questionId: 'q3', selectedIndex: 2 },
      ],
    });
    expect(out.correctCount).toBe(2);
    expect(out.score).toBeCloseTo(0.5, 10);
    expect(out.bySubtopic).toEqual({ trees: { correct: 1, total: 2 }, graphs: { correct: 1, total: 2 } });
    expect(out.perQuestion.find((q) => q.question === 'q4')).toMatchObject({ selectedIndex: null, correct: false });
  });

  test('the first answer for a question wins if it is sent twice', () => {
    const out = scoreAttempt({
      attemptQuestions: [attemptQuestions[0]],
      answerKey,
      answers: [
        { questionId: 'q1', selectedIndex: 2 },
        { questionId: 'q1', selectedIndex: 0 },
      ],
    });
    expect(out.correctCount).toBe(0);
  });

  test('a perfect test feeds the skill update: 0.5 -> 0.65', () => {
    const out = scoreAttempt({
      attemptQuestions: attemptQuestions.slice(0, 2),
      answerKey,
      answers: [
        { questionId: 'q1', selectedIndex: 0 },
        { questionId: 'q2', selectedIndex: 1 },
      ],
    });
    expect(updateLevel(0.5, out.bySubtopic.trees.correct / out.bySubtopic.trees.total)).toBeCloseTo(0.65, 10);
  });
});

describe('buildProgress', () => {
  const attempts = [
    { _id: 'a1', subject: 'DSA', score: 0.4, submittedAt: new Date('2026-10-01'), subtopicScores: [{ subtopic: 'trees', score: 0.2, levelAfter: 0.44 }, { subtopic: 'graphs', score: 0.6, levelAfter: 0.53 }] },
    { _id: 'a2', subject: 'DSA', score: 0.7, submittedAt: new Date('2026-10-08'), subtopicScores: [{ subtopic: 'trees', score: 0.8, levelAfter: 0.55 }] },
  ];

  test('reports improvement since the first test per subject and subtopic', () => {
    const out = buildProgress(attempts);
    expect(out.DSA.tests).toBe(2);
    expect(out.DSA.improvement).toBeCloseTo(0.3, 10);
    const trees = out.DSA.subtopics.find((s) => s.subtopic === 'trees');
    expect(trees.firstScore).toBe(0.2);
    expect(trees.latestScore).toBe(0.8);
    expect(trees.improvement).toBeCloseTo(0.6, 10);
    expect(trees.history).toHaveLength(2);
  });

  test('no attempts gives an empty result', () => {
    expect(buildProgress([])).toEqual({});
  });
});
