'use strict';

const { selectQuestions } = require('../../src/services/selector');

const q = (id, difficulty) => ({ id, difficulty });
const noShuffle = () => 0;

describe('selectQuestions', () => {
  test('prefers unseen questions over seen ones', () => {
    const candidates = [q('a', 'medium'), q('b', 'medium'), q('c', 'medium')];
    const seen = new Map([['a', new Date('2026-01-01')]]);
    const out = selectQuestions({ candidates, seen, targetDifficulty: 'medium', count: 2, rng: noShuffle });
    expect(out.selected.map((x) => x.id).sort()).toEqual(['b', 'c']);
    expect(out.needsGeneration).toBe(false);
    expect(out.fallbackUsed).toBe(0);
  });

  test('among unseen questions, the nearest difficulty to the target comes first', () => {
    const candidates = [q('hard1', 'hard'), q('easy1', 'easy'), q('med1', 'medium')];
    const out = selectQuestions({ candidates, seen: new Map(), targetDifficulty: 'medium', count: 3, rng: noShuffle });
    expect(out.selected[0].id).toBe('med1');
  });

  test('a hard target prefers medium over easy when no hard question is unseen', () => {
    const candidates = [q('easy1', 'easy'), q('med1', 'medium')];
    const out = selectQuestions({ candidates, seen: new Map(), targetDifficulty: 'hard', count: 1, rng: noShuffle });
    expect(out.selected.map((x) => x.id)).toEqual(['med1']);
  });

  test('an unseen question at the wrong difficulty beats a seen one at the right difficulty', () => {
    const candidates = [q('seenMed', 'medium'), q('freshHard', 'hard')];
    const seen = new Map([['seenMed', new Date('2026-01-01')]]);
    const out = selectQuestions({ candidates, seen, targetDifficulty: 'medium', count: 1, rng: noShuffle });
    expect(out.selected.map((x) => x.id)).toEqual(['freshHard']);
  });

  test('when unseen questions run out it asks for generation and falls back to the oldest seen', () => {
    const candidates = [q('new', 'medium'), q('old', 'medium'), q('older', 'medium'), q('newest', 'medium')];
    const seen = new Map([
      ['old', new Date('2026-02-01')],
      ['older', new Date('2026-01-01')],
      ['newest', new Date('2026-03-01')],
    ]);
    const out = selectQuestions({ candidates, seen, targetDifficulty: 'medium', count: 3, rng: noShuffle });
    expect(out.selected.map((x) => x.id)).toEqual(['new', 'older', 'old']);
    expect(out.needsGeneration).toBe(true);
    expect(out.generationCount).toBe(2);
    expect(out.fallbackUsed).toBe(2);
    expect(out.short).toBe(0);
  });

  test('the oldest-seen fallback uses difficulty only to break ties in age', () => {
    const when = new Date('2026-01-01');
    const candidates = [q('hardOld', 'hard'), q('medOld', 'medium')];
    const seen = new Map([
      ['hardOld', when],
      ['medOld', when],
    ]);
    const out = selectQuestions({ candidates, seen, targetDifficulty: 'medium', count: 1, rng: noShuffle });
    expect(out.selected.map((x) => x.id)).toEqual(['medOld']);
  });

  test('never returns the same question twice and reports a shortfall when the bank is too small', () => {
    const candidates = [q('a', 'easy'), q('b', 'easy')];
    const seen = new Map([['a', new Date('2026-01-01')]]);
    const out = selectQuestions({ candidates, seen, targetDifficulty: 'easy', count: 5, rng: noShuffle });
    expect(out.selected.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(out.short).toBe(3);
    expect(out.needsGeneration).toBe(true);
  });

  test('a retest after seeing everything still returns questions, oldest first', () => {
    const candidates = [q('a', 'medium'), q('b', 'medium')];
    const seen = new Map([
      ['a', new Date('2026-05-01')],
      ['b', new Date('2026-04-01')],
    ]);
    const out = selectQuestions({ candidates, seen, targetDifficulty: 'medium', count: 1, rng: noShuffle });
    expect(out.selected.map((x) => x.id)).toEqual(['b']);
  });
});
