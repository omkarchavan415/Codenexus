'use strict';

const Question = require('../../src/models/Question');
const Problem = require('../../src/models/Problem');
const Company = require('../../src/models/Company');
const { questionHash } = require('../../src/services/questionGenerator');

const validQuestion = () => ({
  subject: 'DSA',
  subtopic: 'trees',
  difficulty: 'easy',
  text: 'Which traversal of a BST yields sorted order?',
  options: ['Inorder', 'Preorder', 'Postorder', 'Level order'],
  correctIndex: 0,
  explanation: 'Inorder visits left, node, right, which is ascending for a BST.',
});

describe('Question model', () => {
  test('a valid question passes and gets a hash from its text', async () => {
    const q = new Question(validQuestion());
    await expect(q.validate()).resolves.toBeUndefined();
    expect(q.hash).toBe(questionHash(q.text));
    expect(q.status).toBe('approved');
  });

  test('needs exactly four options and a correctIndex inside 0-3', async () => {
    await expect(new Question({ ...validQuestion(), options: ['a', 'b', 'c'] }).validate()).rejects.toThrow();
    await expect(new Question({ ...validQuestion(), correctIndex: 4 }).validate()).rejects.toThrow();
  });

  test('the subtopic must belong to the subject', async () => {
    await expect(new Question({ ...validQuestion(), subject: 'SQL' }).validate()).rejects.toThrow(/Subtopic/);
  });

  test('toClient never exposes the answer key, explanation or stats', () => {
    const client = new Question(validQuestion()).toClient();
    expect(Object.keys(client).sort()).toEqual(['difficulty', 'id', 'options', 'subject', 'subtopic', 'text']);
  });
});

describe('Problem model', () => {
  const valid = { title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', subject: 'DSA', subtopic: 'hashing', difficulty: 'easy' };

  test('accepts a LeetCode problem link', async () => {
    await expect(new Problem(valid).validate()).resolves.toBeUndefined();
  });

  test.each(['http://leetcode.com/problems/two-sum/', 'https://example.com/problems/two-sum/', 'https://leetcode.com/two-sum'])('rejects %s', async (url) => {
    await expect(new Problem({ ...valid, url }).validate()).rejects.toThrow();
  });

  test('the subtopic must belong to the subject', async () => {
    await expect(new Problem({ ...valid, subject: 'OS' }).validate()).rejects.toThrow(/Subtopic/);
  });
});

describe('Company model', () => {
  test('weights must be high, medium or low and subjects unique', async () => {
    const ok = new Company({ name: 'X', slug: 'x', skills: [{ subject: 'DSA', weight: 'high' }, { subject: 'SQL', weight: 'low' }] });
    await expect(ok.validate()).resolves.toBeUndefined();
    await expect(new Company({ name: 'X', slug: 'x', skills: [{ subject: 'DSA', weight: 'huge' }] }).validate()).rejects.toThrow();
    await expect(
      new Company({ name: 'X', slug: 'x', skills: [{ subject: 'DSA', weight: 'high' }, { subject: 'DSA', weight: 'low' }] }).validate(),
    ).rejects.toThrow(/only once/);
  });
});
