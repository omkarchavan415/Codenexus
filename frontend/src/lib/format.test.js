import { describe, expect, test } from 'vitest';
import { clock, levelColor, levelWord, minutesLabel, pct } from './format';

describe('format helpers', () => {
  test('pct rounds and guards', () => {
    expect(pct(0.456)).toBe('46%');
    expect(pct(undefined)).toBe('-');
  });
  test('levelColor matches the difficulty cut-offs', () => {
    expect(levelColor(0.39)).toBe('#EF6F5A');
    expect(levelColor(0.4)).toBe('#F0B03A');
    expect(levelColor(0.7)).toBe('#6ED3A3');
  });
  test('levelWord', () => {
    expect(levelWord(0.85)).toBe('Mastered');
    expect(levelWord(null)).toBe('Not tested');
  });
  test('minutesLabel and clock', () => {
    expect(minutesLabel(45)).toBe('45 min');
    expect(minutesLabel(90)).toBe('1 h 30 min');
    expect(clock(125)).toBe('02:05');
    expect(clock(-3)).toBe('00:00');
  });
});
