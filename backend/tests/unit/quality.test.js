'use strict';

const { questionQuality } = require('../../src/services/quality');

describe('questionQuality', () => {
  test('makes no judgement without enough attempts', () => {
    const q = questionQuality({ timesAsked: 4, timesCorrect: 0, difficulty: 'easy' });
    expect(q.flag).toBeNull();
    expect(q.enoughData).toBe(false);
    expect(q.accuracy).toBe(0);
  });

  test('has no accuracy for a question nobody has seen', () => {
    expect(questionQuality({ timesAsked: 0, timesCorrect: 0, difficulty: 'easy' }).accuracy).toBeNull();
  });

  test('flags a likely wrong answer key', () => {
    expect(questionQuality({ timesAsked: 40, timesCorrect: 3, difficulty: 'medium' }).flag).toBe('possible_wrong_key');
  });

  test('flags questions that everyone gets right', () => {
    expect(questionQuality({ timesAsked: 50, timesCorrect: 50, difficulty: 'medium' }).flag).toBe('too_easy');
  });

  test('flags a difficulty label that does not match results', () => {
    expect(questionQuality({ timesAsked: 20, timesCorrect: 6, difficulty: 'easy' }).flag).toBe('harder_than_labelled');
    expect(questionQuality({ timesAsked: 20, timesCorrect: 18, difficulty: 'hard' }).flag).toBe('easier_than_labelled');
  });

  test('leaves a healthy question alone and clamps bad counters', () => {
    expect(questionQuality({ timesAsked: 30, timesCorrect: 18, difficulty: 'medium' }).flag).toBeNull();
    expect(questionQuality({ timesAsked: 10, timesCorrect: 99, difficulty: 'medium' }).correct).toBe(10);
  });

  test('honours a custom minimum', () => {
    expect(questionQuality({ timesAsked: 5, timesCorrect: 0, difficulty: 'medium' }, { minAsked: 5 }).flag).toBe('possible_wrong_key');
  });
});
