'use strict';

const { parseCsv, parseImport, MAX_ROWS } = require('../../src/services/importParser');

const header = 'subject,subtopic,difficulty,text,optionA,optionB,optionC,optionD,correct,explanation';

describe('parseCsv', () => {
  test('handles quotes, commas, escaped quotes and newlines inside fields', () => {
    const rows = parseCsv('a,"b, with comma","say ""hi""","line1\nline2"\r\nx,y,z,w\r\n');
    expect(rows).toEqual([
      ['a', 'b, with comma', 'say "hi"', 'line1\nline2'],
      ['x', 'y', 'z', 'w'],
    ]);
  });

  test('ignores a BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\n\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('parseImport (csv)', () => {
  const row = 'dsa,arrays,easy,"What is the time complexity of reading arr[i]?",O(1),O(n),O(log n),O(n^2),A,Array access by index is constant time.';

  test('accepts a valid row and normalises case', () => {
    const out = parseImport({ format: 'csv', content: `${header}\n${row}` });
    expect(out.error).toBeNull();
    expect(out.invalid).toEqual([]);
    expect(out.valid).toHaveLength(1);
    expect(out.valid[0]).toMatchObject({ subject: 'DSA', subtopic: 'arrays', difficulty: 'easy', correctIndex: 0 });
  });

  test('reports missing columns', () => {
    const out = parseImport({ format: 'csv', content: 'subject,text\nDSA,hello' });
    expect(out.error).toMatch(/Missing CSV columns/);
  });

  test('reports row-level problems without dropping good rows', () => {
    const bad = 'DSA,not-a-subtopic,easy,"Some long enough question text",a,b,c,d,A,Because reasons here.';
    const dup = 'DSA,arrays,easy,"Another long enough question",same,same,c,d,B,Because reasons here.';
    const out = parseImport({ format: 'csv', content: [header, row, bad, dup].join('\n') });
    expect(out.valid).toHaveLength(1);
    expect(out.invalid.map((i) => i.row)).toEqual([2, 3]);
    expect(out.invalid[0].errors.join(' ')).toMatch(/does not belong/);
    expect(out.invalid[1].errors.join(' ')).toMatch(/distinct/);
  });

  test('rejects an answer letter outside A-D', () => {
    const out = parseImport({ format: 'csv', content: `${header}\n${row.replace(',A,', ',E,')}` });
    expect(out.valid).toHaveLength(0);
    expect(out.invalid[0].errors.join(' ')).toMatch(/correct must be A, B, C or D/);
  });
});

describe('parseImport (json)', () => {
  const item = {
    subject: 'sql',
    subtopic: 'joins',
    difficulty: 'MEDIUM',
    text: 'Which join returns only rows with matches in both tables?',
    options: ['INNER JOIN', 'LEFT JOIN', 'FULL JOIN', 'CROSS JOIN'],
    correctIndex: 0,
    explanation: 'INNER JOIN keeps only matching rows.',
  };

  test('accepts an array and the { questions } wrapper', () => {
    expect(parseImport({ format: 'json', content: JSON.stringify([item]) }).valid).toHaveLength(1);
    expect(parseImport({ format: 'json', content: JSON.stringify({ questions: [item] }) }).valid).toHaveLength(1);
  });

  test('accepts a letter in "correct" instead of correctIndex', () => {
    const { correctIndex, ...rest } = item;
    const out = parseImport({ format: 'json', content: [{ ...rest, correct: 'c' }] });
    expect(out.valid[0].correctIndex).toBe(2);
  });

  test('rejects broken JSON, wrong shapes and oversized files', () => {
    expect(parseImport({ format: 'json', content: '{oops' }).error).toMatch(/could not be parsed/);
    expect(parseImport({ format: 'json', content: '{"a":1}' }).error).toMatch(/Expected a JSON array/);
    expect(parseImport({ format: 'json', content: '[]' }).error).toMatch(/No questions/);
    const many = Array.from({ length: MAX_ROWS + 1 }, () => item);
    expect(parseImport({ format: 'json', content: many }).error).toMatch(/at most/);
  });
});
