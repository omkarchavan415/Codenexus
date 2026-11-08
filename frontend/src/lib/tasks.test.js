import { describe, expect, test } from 'vitest';
import { trackId, trackedTasks } from './tasks';

describe('trackId', () => {
  test('uses the problem id, item id or quiz key', () => {
    expect(trackId({ type: 'problem', problemId: 'p1' })).toBe('p1');
    expect(trackId({ type: 'resource', itemId: 'i1' })).toBe('i1');
    expect(trackId({ type: 'practical', itemId: 'i2' })).toBe('i2');
    expect(trackId({ type: 'quiz', subject: 'OS', subtopic: 'cpu-scheduling' })).toBe('quiz:OS:cpu-scheduling');
  });

  test('study and review tasks have no checkbox', () => {
    expect(trackId({ type: 'study' })).toBeNull();
    expect(trackId({ type: 'review' })).toBeNull();
  });
});

describe('trackedTasks', () => {
  test('keeps only tasks that can be ticked off', () => {
    const schedule = [
      { tasks: [{ type: 'study' }, { type: 'resource', itemId: 'a' }] },
      { tasks: [{ type: 'quiz', subject: 'DSA', subtopic: 'trees' }, { type: 'review' }] },
    ];
    expect(trackedTasks(schedule)).toHaveLength(2);
  });
});
