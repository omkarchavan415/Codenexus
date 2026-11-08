'use strict';

const { generateQuestions, questionHash } = require('../../src/services/questionGenerator');

const good = (n, correctIndex = 1) => ({
  text: `Which traversal visits the root of a binary tree first? (variant ${n})`,
  options: ['Inorder', 'Preorder', 'Postorder', 'Level skipped'].map((o) => `${o} ${n}`),
  correctIndex,
  explanation: 'Preorder visits the root before its subtrees.',
});

function fakeStore(existing = []) {
  const saved = [];
  return {
    saved,
    findExistingHashes: async (hashes) => new Set(hashes.filter((h) => existing.includes(h))),
    insertPending: async (docs) => {
      saved.push(...docs);
      return docs;
    },
  };
}

/** Fake Gemini: first call returns the batch, later calls answer verification prompts. */
function fakeGemini({ batch, answers }) {
  let verifyCall = 0;
  const calls = [];
  return {
    calls,
    enabled: true,
    generateJson: async (prompt) => {
      calls.push(prompt);
      if (calls.length === 1) return batch;
      const next = answers[verifyCall];
      verifyCall += 1;
      if (next instanceof Error) throw next;
      return { answerIndex: next };
    },
  };
}

const args = { subject: 'DSA', subtopic: 'trees', difficulty: 'easy', count: 5 };

describe('questionHash', () => {
  test('ignores case, punctuation and spacing', () => {
    expect(questionHash('What  is a Tree?')).toBe(questionHash('what is a tree'));
    expect(questionHash('What is a tree?')).not.toBe(questionHash('What is a graph?'));
  });
});

describe('generateQuestions', () => {
  test('saves verified questions as pending', async () => {
    const store = fakeStore();
    const gemini = fakeGemini({ batch: { questions: [good(1), good(2)] }, answers: [1, 1] });
    const out = await generateQuestions({ ...args, gemini, store });
    expect(out.created).toHaveLength(2);
    expect(store.saved.every((d) => d.status === 'pending' && d.source === 'gemini' && d.subject === 'DSA')).toBe(true);
    expect(gemini.calls).toHaveLength(3); // 1 generation + 2 verifications
  });

  test('rejects items that break the strict format', async () => {
    const store = fakeStore();
    const batch = {
      questions: [
        good(1),
        { ...good(2), options: ['only', 'three', 'options'] },
        { ...good(3), correctIndex: 7 },
        { ...good(4), extra: 'not allowed' },
        { ...good(5), options: ['same', 'same', 'other', 'another'] },
        { text: 'short', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'no' },
      ],
    };
    const gemini = fakeGemini({ batch, answers: [1] });
    const out = await generateQuestions({ ...args, gemini, store });
    expect(out.created).toHaveLength(1);
    expect(out.rejected.invalidFormat).toBe(5);
  });

  test('rejects duplicates of questions already in the bank and inside the batch', async () => {
    const dup = good(1);
    const store = fakeStore([questionHash(dup.text)]);
    const gemini = fakeGemini({ batch: { questions: [dup, good(2), { ...good(2) }] }, answers: [1] });
    const out = await generateQuestions({ ...args, gemini, store });
    expect(out.created).toHaveLength(1);
    expect(out.rejected.duplicate).toBe(2);
  });

  test('rejects a question when the second call disagrees about the answer', async () => {
    const store = fakeStore();
    const gemini = fakeGemini({ batch: { questions: [good(1), good(2)] }, answers: [1, 3] });
    const out = await generateQuestions({ ...args, gemini, store });
    expect(out.created).toHaveLength(1);
    expect(out.rejected.verificationFailed).toBe(1);
  });

  test('a question that could not be verified is not saved', async () => {
    const store = fakeStore();
    const gemini = fakeGemini({ batch: { questions: [good(1)] }, answers: [new Error('boom')] });
    const out = await generateQuestions({ ...args, gemini, store });
    expect(out.created).toHaveLength(0);
    expect(out.rejected.verificationFailed).toBe(1);
    expect(store.saved).toHaveLength(0);
  });

  test('a Gemini outage yields a skipped result, not an exception', async () => {
    const gemini = { enabled: true, generateJson: async () => { throw new Error('down'); } };
    const out = await generateQuestions({ ...args, gemini, store: fakeStore() });
    expect(out.skipped).toBe('gemini_unavailable');
    expect(out.created).toEqual([]);
  });

  test('an unexpected response shape is skipped', async () => {
    const gemini = { enabled: true, generateJson: async () => ({ nope: true }) };
    const out = await generateQuestions({ ...args, gemini, store: fakeStore() });
    expect(out.skipped).toBe('invalid_response');
  });

  test('without Gemini configured nothing is attempted', async () => {
    const out = await generateQuestions({ ...args, gemini: { enabled: false }, store: fakeStore() });
    expect(out.skipped).toBe('gemini_not_configured');
  });

  test('never saves more than requested', async () => {
    const store = fakeStore();
    const gemini = fakeGemini({ batch: { questions: [good(1), good(2), good(3)] }, answers: [1, 1, 1] });
    const out = await generateQuestions({ ...args, count: 2, gemini, store });
    expect(out.created).toHaveLength(2);
  });

  test('rejects an unknown subtopic', async () => {
    await expect(generateQuestions({ ...args, subtopic: 'nope', gemini: { enabled: true }, store: fakeStore() })).rejects.toThrow();
  });
});
