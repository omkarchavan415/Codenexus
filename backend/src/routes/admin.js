'use strict';

const express = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Problem = require('../models/Problem');
const ProblemProgress = require('../models/ProblemProgress');
const StudyItem = require('../models/StudyItem');
const StudyProgress = require('../models/StudyProgress');
const Company = require('../models/Company');
const cache = require('../services/cache');
const User = require('../models/User');
const TestAttempt = require('../models/TestAttempt');
const Roadmap = require('../models/Roadmap');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler, notFound, conflict, badRequest } = require('../utils/errors');
const { SUBJECTS, DIFFICULTIES, WEIGHTS, isValidSubtopic } = require('../config/taxonomy');
const { questionHash, generateQuestions } = require('../services/questionGenerator');
const { mongoQuestionStore } = require('../services/questionStore');
const { parseImport, importItemSchema } = require('../services/importParser');
const { questionQuality, MIN_ASKED_DEFAULT } = require('../services/quality');

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const STATUSES = ['pending', 'approved', 'rejected'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const paging = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

const questionBody = z
  .object({
    subject: z.enum(SUBJECTS),
    subtopic: z.string().trim().min(1),
    difficulty: z.enum(DIFFICULTIES),
    text: z.string().trim().min(10).max(1500),
    options: z
      .array(z.string().trim().min(1).max(500))
      .length(4)
      .refine((o) => new Set(o.map((x) => x.toLowerCase())).size === 4, 'Options must be distinct'),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(5).max(2000),
    status: z.enum(STATUSES).optional(),
  })
  .strict()
  .refine((q) => isValidSubtopic(q.subject, q.subtopic), { message: 'Subtopic does not belong to the subject', path: ['subtopic'] });

const studyItemBody = z
  .object({
    type: z.enum(['resource', 'practical']),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1500).default(''),
    url: z.string().trim().max(500).regex(/^(https?:\/\/\S+)?$/, 'url must start with http:// or https://').default(''),
    minutes: z.number().int().min(5).max(240),
    subject: z.enum(SUBJECTS),
    subtopic: z.string().trim().min(1),
    active: z.boolean().default(true),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (!isValidSubtopic(b.subject, b.subtopic)) ctx.addIssue({ code: 'custom', path: ['subtopic'], message: 'Subtopic does not belong to the subject' });
    if (b.type === 'resource' && !b.url) ctx.addIssue({ code: 'custom', path: ['url'], message: 'A resource needs a link' });
    if (b.type === 'practical' && !b.description) ctx.addIssue({ code: 'custom', path: ['description'], message: 'A practical needs instructions' });
  });

const problemBody = z
  .object({
    title: z.string().trim().min(2).max(200),
    url: z.string().trim().regex(/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/?$/, 'url must be a leetcode.com/problems/<slug> link'),
    subject: z.enum(SUBJECTS),
    subtopic: z.string().trim().min(1),
    difficulty: z.enum(DIFFICULTIES),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((p) => isValidSubtopic(p.subject, p.subtopic), { message: 'Subtopic does not belong to the subject', path: ['subtopic'] });

const companyBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z.string().trim().toLowerCase().min(2).max(60).optional(),
    role: z.string().trim().min(2).max(80).default('Software Engineer'),
    description: z.string().trim().max(1000).default(''),
    skills: z
      .array(z.object({ subject: z.enum(SUBJECTS), weight: z.enum(WEIGHTS) }).strict())
      .min(1, 'Add at least one skill')
      .refine((s) => new Set(s.map((x) => x.subject)).size === s.length, 'A subject can appear only once'),
    active: z.boolean().optional(),
  })
  .strict();

function createAdminRouter({ gemini } = {}) {
  const router = express.Router();
  router.use(authenticate, requireRole('admin'));

  const withQuality = (q) => ({ ...q, quality: questionQuality(q) });

  /* ----------------------------- questions ----------------------------- */

  router.get(
    '/questions',
    validate({
      query: z.object({
        subject: z.enum(SUBJECTS).optional(),
        subtopic: z.string().optional(),
        difficulty: z.enum(DIFFICULTIES).optional(),
        status: z.enum(STATUSES).optional(),
        source: z.enum(['seed', 'admin', 'import', 'gemini']).optional(),
        flagged: bool.optional(),
        q: z.string().trim().max(100).optional(),
        ...paging,
      }),
    }),
    asyncHandler(async (req, res) => {
      const { page, limit, q, flagged, ...filters } = req.query;
      const filter = { ...filters };
      if (flagged !== undefined) filter.flagged = flagged;
      if (q) filter.text = { $regex: escapeRegex(q), $options: 'i' };
      const [total, rows] = await Promise.all([
        Question.countDocuments(filter),
        Question.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      res.json({ total, page, limit, questions: rows.map((r) => withQuality({ ...r, id: String(r._id) })) });
    }),
  );

  router.post(
    '/questions',
    validate({ body: questionBody }),
    asyncHandler(async (req, res) => {
      try {
        const doc = await Question.create({ ...req.body, status: req.body.status || 'approved', source: 'admin', reviewedBy: req.user._id, reviewedAt: new Date() });
        res.status(201).json({ question: withQuality(doc.toObject()) });
      } catch (err) {
        if (err.code === 11000) throw conflict('A question with the same text already exists', 'duplicate');
        throw err;
      }
    }),
  );

  router.put(
    '/questions/:id',
    validate({ params: z.object({ id: objectId }), body: questionBody }),
    asyncHandler(async (req, res) => {
      const doc = await Question.findById(req.params.id);
      if (!doc) throw notFound('Question not found');
      Object.assign(doc, req.body);
      try {
        await doc.save();
      } catch (err) {
        if (err.code === 11000) throw conflict('A question with the same text already exists', 'duplicate');
        throw err;
      }
      res.json({ question: withQuality(doc.toObject()) });
    }),
  );

  router.delete(
    '/questions/:id',
    validate({ params: z.object({ id: objectId }) }),
    asyncHandler(async (req, res) => {
      const doc = await Question.findById(req.params.id);
      if (!doc) throw notFound('Question not found');
      // Past test results still show this question, so a question students have answered is retired, not erased.
      if (doc.timesAsked > 0) {
        doc.status = 'rejected';
        await doc.save();
        return res.json({ archived: true, id: String(doc._id) });
      }
      await doc.deleteOne();
      return res.json({ deleted: true, id: String(doc._id) });
    }),
  );

  router.post(
    '/questions/:id/review',
    validate({ params: z.object({ id: objectId }), body: z.object({ action: z.enum(['approve', 'reject']) }).strict() }),
    asyncHandler(async (req, res) => {
      const doc = await Question.findById(req.params.id);
      if (!doc) throw notFound('Question not found');
      doc.status = req.body.action === 'approve' ? 'approved' : 'rejected';
      doc.reviewedBy = req.user._id;
      doc.reviewedAt = new Date();
      await doc.save();
      res.json({ question: withQuality(doc.toObject()) });
    }),
  );

  router.post(
    '/questions/bulk-review',
    validate({ body: z.object({ ids: z.array(objectId).min(1).max(200), action: z.enum(['approve', 'reject']) }).strict() }),
    asyncHandler(async (req, res) => {
      const result = await Question.updateMany(
        { _id: { $in: req.body.ids } },
        { $set: { status: req.body.action === 'approve' ? 'approved' : 'rejected', reviewedBy: req.user._id, reviewedAt: new Date() } },
      );
      res.json({ matched: result.matchedCount, modified: result.modifiedCount });
    }),
  );

  router.patch(
    '/questions/:id/flag',
    validate({ params: z.object({ id: objectId }), body: z.object({ flagged: z.boolean() }).strict() }),
    asyncHandler(async (req, res) => {
      const doc = await Question.findByIdAndUpdate(req.params.id, { $set: { flagged: req.body.flagged } }, { new: true });
      if (!doc) throw notFound('Question not found');
      res.json({ question: withQuality(doc.toObject()) });
    }),
  );

  router.post(
    '/questions/import',
    validate({
      body: z
        .object({
          format: z.enum(['csv', 'json']),
          content: z.union([z.string().min(1), z.array(z.unknown()), z.object({}).passthrough()]),
          status: z.enum(['pending', 'approved']).default('approved'),
        })
        .strict(),
    }),
    asyncHandler(async (req, res) => {
      const parsed = parseImport({ format: req.body.format, content: req.body.content });
      if (parsed.error) throw badRequest(parsed.error, 'bad_import');

      const hashes = parsed.valid.map((q) => questionHash(q.text));
      const existing = await mongoQuestionStore.findExistingHashes(hashes);
      const seen = new Set();
      let duplicates = 0;
      const docs = [];
      parsed.valid.forEach((q, i) => {
        if (existing.has(hashes[i]) || seen.has(hashes[i])) {
          duplicates += 1;
          return;
        }
        seen.add(hashes[i]);
        docs.push({ ...q, hash: hashes[i], status: req.body.status, source: 'import', reviewedBy: req.user._id, reviewedAt: new Date() });
      });

      let created = 0;
      for (const doc of docs) {
        try {
          await Question.create(doc);
          created += 1;
        } catch (err) {
          if (err.code === 11000) duplicates += 1;
          else throw err;
        }
      }
      res.status(created ? 201 : 200).json({ received: parsed.valid.length + parsed.invalid.length, created, duplicates, invalid: parsed.invalid });
    }),
  );

  /* ------------------------------ generator ----------------------------- */

  router.post(
    '/generate',
    validate({
      body: z
        .object({
          subject: z.enum(SUBJECTS),
          subtopic: z.string().trim().min(1),
          difficulty: z.enum(DIFFICULTIES),
          count: z.number().int().min(1).max(10).default(5),
        })
        .strict()
        .refine((b) => isValidSubtopic(b.subject, b.subtopic), { message: 'Subtopic does not belong to the subject', path: ['subtopic'] }),
    }),
    asyncHandler(async (req, res) => {
      const result = await generateQuestions({ ...req.body, gemini, store: mongoQuestionStore });
      res.json({
        requested: result.requested,
        skipped: result.skipped,
        rejected: result.rejected,
        created: result.created.map((d) => ({ id: String(d._id), text: d.text })),
      });
    }),
  );

  /* ------------------------------- quality ------------------------------ */

  router.get(
    '/quality',
    validate({
      query: z.object({
        subject: z.enum(SUBJECTS).optional(),
        minAsked: z.coerce.number().int().min(1).max(10000).default(MIN_ASKED_DEFAULT),
        flaggedOnly: bool.default('false'),
      }),
    }),
    asyncHandler(async (req, res) => {
      const { subject, minAsked, flaggedOnly } = req.query;
      const filter = { timesAsked: { $gte: 1 } };
      if (subject) filter.subject = subject;
      const rows = await Question.find(filter).lean();
      let items = rows.map((r) => ({
        id: String(r._id),
        subject: r.subject,
        subtopic: r.subtopic,
        difficulty: r.difficulty,
        text: r.text,
        status: r.status,
        flaggedByAdmin: r.flagged,
        ...questionQuality(r, { minAsked }),
      }));
      if (flaggedOnly) items = items.filter((i) => i.flag || i.flaggedByAdmin);
      // Well-measured questions first (lowest accuracy first); thin samples after them.
      items.sort((a, b) => Number(b.enoughData) - Number(a.enoughData) || (a.accuracy ?? 2) - (b.accuracy ?? 2) || b.asked - a.asked);
      res.json({ minAsked, total: items.length, questions: items.slice(0, 300) });
    }),
  );

  /* ------------------------------ companies ----------------------------- */

  // The public company list is cached; drop it whenever an admin changes a company.
  router.use('/companies', (req, res, next) => {
    if (req.method !== 'GET') res.on('finish', () => cache.del('companies:active'));
    next();
  });

  router.get(
    '/companies',
    asyncHandler(async (req, res) => {
      const rows = await Company.find().sort({ name: 1 }).lean();
      res.json({ companies: rows.map((c) => ({ ...c, id: String(c._id) })) });
    }),
  );

  router.post(
    '/companies',
    validate({ body: companyBody }),
    asyncHandler(async (req, res) => {
      try {
        const doc = await Company.create({ ...req.body, slug: req.body.slug || slugify(req.body.name) });
        res.status(201).json({ company: { ...doc.toObject(), id: String(doc._id) } });
      } catch (err) {
        if (err.code === 11000) throw conflict('A company with that slug already exists', 'duplicate');
        throw err;
      }
    }),
  );

  router.put(
    '/companies/:id',
    validate({ params: z.object({ id: objectId }), body: companyBody }),
    asyncHandler(async (req, res) => {
      const doc = await Company.findById(req.params.id);
      if (!doc) throw notFound('Company not found');
      Object.assign(doc, req.body, { slug: req.body.slug || doc.slug });
      try {
        await doc.save();
      } catch (err) {
        if (err.code === 11000) throw conflict('A company with that slug already exists', 'duplicate');
        throw err;
      }
      res.json({ company: { ...doc.toObject(), id: String(doc._id) } });
    }),
  );

  router.delete(
    '/companies/:id',
    validate({ params: z.object({ id: objectId }) }),
    asyncHandler(async (req, res) => {
      const doc = await Company.findById(req.params.id);
      if (!doc) throw notFound('Company not found');
      const inUse = await User.countDocuments({ 'goal.company': doc._id });
      if (inUse) {
        doc.active = false;
        await doc.save();
        return res.json({ archived: true, id: String(doc._id), students: inUse });
      }
      await doc.deleteOne();
      return res.json({ deleted: true, id: String(doc._id) });
    }),
  );

  /* ------------------------------- problems ----------------------------- */

  router.get(
    '/problems',
    validate({
      query: z.object({
        subject: z.enum(SUBJECTS).optional(),
        subtopic: z.string().optional(),
        difficulty: z.enum(DIFFICULTIES).optional(),
        active: bool.optional(),
        q: z.string().trim().max(100).optional(),
        ...paging,
      }),
    }),
    asyncHandler(async (req, res) => {
      const { page, limit, q, ...filters } = req.query;
      const filter = { ...filters };
      if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
      const [total, rows] = await Promise.all([
        Problem.countDocuments(filter),
        Problem.find(filter).sort({ subject: 1, subtopic: 1, difficulty: 1, title: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      res.json({ total, page, limit, problems: rows.map((p) => ({ ...p, id: String(p._id) })) });
    }),
  );

  router.post(
    '/problems',
    validate({ body: problemBody }),
    asyncHandler(async (req, res) => {
      try {
        const doc = await Problem.create(req.body);
        res.status(201).json({ problem: { ...doc.toObject(), id: String(doc._id) } });
      } catch (err) {
        if (err.code === 11000) throw conflict('That problem URL is already in the list', 'duplicate');
        throw err;
      }
    }),
  );

  router.put(
    '/problems/:id',
    validate({ params: z.object({ id: objectId }), body: problemBody }),
    asyncHandler(async (req, res) => {
      const doc = await Problem.findById(req.params.id);
      if (!doc) throw notFound('Problem not found');
      Object.assign(doc, req.body);
      try {
        await doc.save();
      } catch (err) {
        if (err.code === 11000) throw conflict('That problem URL is already in the list', 'duplicate');
        throw err;
      }
      res.json({ problem: { ...doc.toObject(), id: String(doc._id) } });
    }),
  );

  router.delete(
    '/problems/:id',
    validate({ params: z.object({ id: objectId }) }),
    asyncHandler(async (req, res) => {
      const doc = await Problem.findById(req.params.id);
      if (!doc) throw notFound('Problem not found');
      // Students may have ticked it off, and old roadmap versions link to it, so retire it instead of erasing it.
      const solvedBy = await ProblemProgress.countDocuments({ problem: doc._id });
      if (solvedBy) {
        doc.active = false;
        await doc.save();
        return res.json({ archived: true, id: String(doc._id), solvedBy });
      }
      await doc.deleteOne();
      return res.json({ deleted: true, id: String(doc._id) });
    }),
  );

  /* ---------------------------- study items ----------------------------- */

  router.get(
    '/study-items',
    validate({
      query: z.object({
        type: z.enum(['resource', 'practical']).optional(),
        subject: z.enum(SUBJECTS).optional(),
        subtopic: z.string().optional(),
        active: bool.optional(),
        q: z.string().trim().max(100).optional(),
        ...paging,
      }),
    }),
    asyncHandler(async (req, res) => {
      const { page, limit, q, ...filters } = req.query;
      const filter = { ...filters };
      if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
      const [total, rows] = await Promise.all([
        StudyItem.countDocuments(filter),
        StudyItem.find(filter).sort({ subject: 1, subtopic: 1, type: 1, title: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      res.json({ total, page, limit, items: rows.map((i) => ({ ...i, id: String(i._id) })) });
    }),
  );

  router.post(
    '/study-items',
    validate({ body: studyItemBody }),
    asyncHandler(async (req, res) => {
      try {
        const doc = await StudyItem.create(req.body);
        res.status(201).json({ item: { ...doc.toObject(), id: String(doc._id) } });
      } catch (err) {
        if (err.code === 11000) throw conflict('That subtopic already has an item with this title and type', 'duplicate');
        throw err;
      }
    }),
  );

  router.put(
    '/study-items/:id',
    validate({ params: z.object({ id: objectId }), body: studyItemBody }),
    asyncHandler(async (req, res) => {
      const doc = await StudyItem.findById(req.params.id);
      if (!doc) throw notFound('Study item not found');
      Object.assign(doc, req.body);
      try {
        await doc.save();
      } catch (err) {
        if (err.code === 11000) throw conflict('That subtopic already has an item with this title and type', 'duplicate');
        throw err;
      }
      res.json({ item: { ...doc.toObject(), id: String(doc._id) } });
    }),
  );

  router.delete(
    '/study-items/:id',
    validate({ params: z.object({ id: objectId }) }),
    asyncHandler(async (req, res) => {
      const doc = await StudyItem.findById(req.params.id);
      if (!doc) throw notFound('Study item not found');
      // Old roadmap versions point at it and students may have ticked it off, so retire it instead of erasing it.
      const doneBy = await StudyProgress.countDocuments({ item: doc._id });
      if (doneBy) {
        doc.active = false;
        await doc.save();
        return res.json({ archived: true, id: String(doc._id), doneBy });
      }
      await doc.deleteOne();
      return res.json({ deleted: true, id: String(doc._id) });
    }),
  );

  /* -------------------------------- stats ------------------------------- */

  router.get(
    '/stats',
    asyncHandler(async (req, res) => {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const [users, students, newUsers, attempts, recentAttempts, avgScore, roadmaps, problems, companies, byStatus, bySubject, byDifficulty, flagged, studyItems] =
        await Promise.all([
          User.countDocuments(),
          User.countDocuments({ role: 'student' }),
          User.countDocuments({ createdAt: { $gte: weekAgo } }),
          TestAttempt.countDocuments({ status: 'submitted' }),
          TestAttempt.countDocuments({ status: 'submitted', submittedAt: { $gte: weekAgo } }),
          TestAttempt.aggregate([{ $match: { status: 'submitted' } }, { $group: { _id: null, avg: { $avg: '$score' } } }]),
          Roadmap.countDocuments({ isActive: true }),
          Problem.countDocuments({ active: true }),
          Company.countDocuments({ active: true }),
          Question.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
          Question.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$subject', n: { $sum: 1 } } }]),
          Question.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$difficulty', n: { $sum: 1 } } }]),
          Question.countDocuments({ flagged: true }),
          StudyItem.countDocuments({ active: true }),
        ]);

      const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
      const status = { pending: 0, approved: 0, rejected: 0, ...toMap(byStatus) };
      res.json({
        users: { total: users, students, admins: users - students, newLast7Days: newUsers },
        attempts: { submitted: attempts, last7Days: recentAttempts, averageScore: avgScore[0] ? avgScore[0].avg : null },
        questions: {
          total: status.pending + status.approved + status.rejected,
          byStatus: status,
          approvedBySubject: toMap(bySubject),
          approvedByDifficulty: toMap(byDifficulty),
          flagged,
        },
        activeRoadmaps: roadmaps,
        activeProblems: problems,
        activeStudyItems: studyItems,
        activeCompanies: companies,
      });
    }),
  );

  return router;
}

module.exports = { createAdminRouter, questionBody, problemBody, studyItemBody, companyBody, importItemSchema, slugify };
