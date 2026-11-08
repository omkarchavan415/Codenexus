'use strict';

const { z } = require('zod');
const { SUBJECTS, DIFFICULTIES, isValidSubtopic } = require('../config/taxonomy');

const MAX_ROWS = 500;

/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and newlines inside
 * quotes, CRLF or LF line endings, optional UTF-8 BOM. Returns an array of rows (arrays of strings).
 */
function parseCsv(input) {
  const text = String(input || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const HEADER_ALIASES = {
  subject: 'subject',
  subtopic: 'subtopic',
  difficulty: 'difficulty',
  text: 'text',
  question: 'text',
  optiona: 'a',
  optionb: 'b',
  optionc: 'c',
  optiond: 'd',
  a: 'a',
  b: 'b',
  c: 'c',
  d: 'd',
  correct: 'correct',
  answer: 'correct',
  explanation: 'explanation',
};

/** CSV rows -> plain objects shaped like the JSON import format. */
function csvToObjects(input) {
  const rows = parseCsv(input);
  if (rows.length < 2) return { items: [], error: 'The CSV needs a header row and at least one question' };
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[^a-z]/g, '')] || null);
  const required = ['subject', 'subtopic', 'difficulty', 'text', 'a', 'b', 'c', 'd', 'correct', 'explanation'];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) {
    return {
      items: [],
      error: `Missing CSV columns: ${missing.join(', ')}. Expected: subject,subtopic,difficulty,text,optionA,optionB,optionC,optionD,correct,explanation`,
    };
  }
  const items = rows.slice(1).map((cells) => {
    const get = (name) => {
      const idx = header.indexOf(name);
      return idx === -1 ? '' : String(cells[idx] === undefined ? '' : cells[idx]).trim();
    };
    const letter = get('correct').toUpperCase();
    return {
      subject: get('subject').toUpperCase(),
      subtopic: get('subtopic').toLowerCase(),
      difficulty: get('difficulty').toLowerCase(),
      text: get('text'),
      options: [get('a'), get('b'), get('c'), get('d')],
      correctIndex: 'ABCD'.indexOf(letter),
      explanation: get('explanation'),
    };
  });
  return { items, error: null };
}

const importItemSchema = z
  .object({
    subject: z.enum(SUBJECTS),
    subtopic: z.string().trim().min(1),
    difficulty: z.enum(DIFFICULTIES),
    text: z.string().trim().min(10, 'Question text is too short').max(1500),
    options: z
      .array(z.string().trim().min(1, 'Options cannot be empty').max(500))
      .length(4, 'A question needs exactly 4 options')
      .refine((o) => new Set(o.map((x) => x.toLowerCase())).size === 4, 'Options must be distinct'),
    correctIndex: z.number().int().min(0, 'correct must be A, B, C or D').max(3, 'correct must be A, B, C or D'),
    explanation: z.string().trim().min(5, 'Every question needs an explanation').max(2000),
  })
  .superRefine((q, ctx) => {
    if (!isValidSubtopic(q.subject, q.subtopic)) {
      ctx.addIssue({ code: 'custom', path: ['subtopic'], message: `Subtopic "${q.subtopic}" does not belong to ${q.subject}` });
    }
  });

/**
 * Parse and validate an import payload.
 * format: 'csv' | 'json'. Returns { valid: [...], invalid: [{ row, errors }], error }.
 * `row` is the 1-based position of the question in the file (not counting the CSV header).
 */
function parseImport({ format, content }) {
  let items;
  if (format === 'csv') {
    const converted = csvToObjects(content);
    if (converted.error) return { valid: [], invalid: [], error: converted.error };
    items = converted.items;
  } else {
    let parsed;
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (err) {
      return { valid: [], invalid: [], error: 'The JSON file could not be parsed' };
    }
    items = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.questions) ? parsed.questions : null;
    if (!items) return { valid: [], invalid: [], error: 'Expected a JSON array of questions, or { "questions": [...] }' };
    items = items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const copy = { ...item };
      if (copy.subject) copy.subject = String(copy.subject).toUpperCase();
      if (copy.difficulty) copy.difficulty = String(copy.difficulty).toLowerCase();
      if (copy.subtopic) copy.subtopic = String(copy.subtopic).toLowerCase();
      if (copy.correctIndex === undefined && typeof copy.correct === 'string') copy.correctIndex = 'ABCD'.indexOf(copy.correct.toUpperCase());
      delete copy.correct;
      return copy;
    });
  }

  if (!items.length) return { valid: [], invalid: [], error: 'No questions found in the file' };
  if (items.length > MAX_ROWS) return { valid: [], invalid: [], error: `Import at most ${MAX_ROWS} questions at a time` };

  const valid = [];
  const invalid = [];
  items.forEach((item, i) => {
    const result = importItemSchema.safeParse(item);
    if (result.success) valid.push(result.data);
    else {
      invalid.push({
        row: i + 1,
        errors: result.error.issues.map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message)),
      });
    }
  });
  return { valid, invalid, error: null };
}

module.exports = { parseCsv, csvToObjects, parseImport, importItemSchema, MAX_ROWS };
