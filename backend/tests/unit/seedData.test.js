'use strict';

const { questions } = require('../../seed/data/questions');
const { problems } = require('../../seed/data/problems');
const { studyItems } = require('../../seed/data/studyItems');
const { retiredUrls } = require('../../seed/data/retired');
const { companies } = require('../../seed/data/companies');
const { validateSeed, summarize } = require('../../seed/validate');
const { TAXONOMY, SUBJECTS, subtopicKeys } = require('../../src/config/taxonomy');

describe('seed data', () => {
  test('passes structural validation', () => {
    expect(validateSeed({ questions, problems, companies, studyItems })).toEqual([]);
  });

  test('meets the content targets', () => {
    expect(questions.length).toBeGreaterThanOrEqual(150);
    expect(problems.length).toBeGreaterThanOrEqual(100);
    expect(companies.map((c) => c.name)).toEqual(
      expect.arrayContaining(['TCS', 'Infosys', 'Accenture', 'Wipro', 'Cognizant', 'Amazon', 'Google', 'Microsoft', 'General Placement']),
    );
  });

  test('every subtopic has easy, medium and hard questions', () => {
    const { bySubtopic } = summarize({ questions, problems });
    for (const subject of SUBJECTS) {
      for (const key of subtopicKeys(subject)) {
        const counts = bySubtopic[`${subject}/${key}`];
        expect(counts).toBeDefined();
        expect(counts.easy).toBeGreaterThanOrEqual(2);
        expect(counts.medium).toBeGreaterThanOrEqual(2);
        expect(counts.hard).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('every DSA and SQL subtopic has at least two practice problems', () => {
    for (const subject of ['DSA', 'SQL']) {
      for (const key of subtopicKeys(subject)) {
        const n = problems.filter((p) => p.subject === subject && p.subtopic === key).length;
        expect({ subject, key, n: n >= 2 }).toEqual({ subject, key, n: true });
      }
    }
  });

  test('the answer key is spread evenly over A-D', () => {
    const counts = [0, 0, 0, 0];
    questions.forEach((q) => { counts[q.correctIndex] += 1; });
    counts.forEach((c) => {
      expect(c / questions.length).toBeGreaterThan(0.2);
      expect(c / questions.length).toBeLessThan(0.3);
    });
  });

  test('every company covers each subject at most once with valid weights', () => {
    companies.forEach((c) => {
      c.skills.forEach((s) => {
        expect(TAXONOMY[s.subject]).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(s.weight);
      });
      expect(c.skills.length).toBe(6);
    });
  });

  test('the validator catches broken data', () => {
    const broken = [{ ...questions[0], options: ['a', 'a', 'b', 'c'] }, { ...questions[0] }];
    const errs = validateSeed({ questions: broken, problems: [{ ...problems[0], url: 'https://example.com/x' }], companies });
    expect(errs.join('\n')).toMatch(/not distinct/);
    expect(errs.join('\n')).toMatch(/duplicate question/);
    expect(errs.join('\n')).toMatch(/bad url/);
  });
});

describe('study items seed', () => {
  test('every subtopic has at least two resources', () => {
    for (const subject of SUBJECTS) {
      for (const key of subtopicKeys(subject)) {
        const n = studyItems.filter((i) => i.type === 'resource' && i.subject === subject && i.subtopic === key).length;
        expect({ subject, key, ok: n >= 2 }).toEqual({ subject, key, ok: true });
      }
    }
  });

  test('every OOP, DBMS, OS and CN subtopic has a hands-on practical', () => {
    for (const subject of ['OOP', 'DBMS', 'OS', 'CN']) {
      for (const key of subtopicKeys(subject)) {
        const n = studyItems.filter((i) => i.type === 'practical' && i.subject === subject && i.subtopic === key).length;
        expect({ subject, key, ok: n >= 1 }).toEqual({ subject, key, ok: true });
      }
    }
  });

  test('theory subjects no longer carry loosely related LeetCode problems', () => {
    expect(problems.filter((p) => ['DBMS', 'OS', 'CN'].includes(p.subject))).toHaveLength(0);
  });

  test('retired problems are not in the current list', () => {
    const current = new Set(problems.map((p) => p.url));
    expect(retiredUrls.length).toBeGreaterThan(0);
    retiredUrls.forEach((u) => expect(current.has(u)).toBe(false));
  });

  test('the validator rejects a resource without a link and a thin practical', () => {
    const bad = [
      { type: 'resource', subject: 'OS', subtopic: 'file-systems', title: 'x', url: '', minutes: 20 },
      { type: 'practical', subject: 'OS', subtopic: 'file-systems', title: 'y', description: 'short', url: '', minutes: 20 },
    ];
    expect(validateSeed({ questions, problems, companies, studyItems: bad }).length).toBe(2);
  });
});
