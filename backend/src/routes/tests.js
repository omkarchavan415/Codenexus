'use strict';

const express = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const TestAttempt = require('../models/TestAttempt');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/errors');
const { SUBJECTS } = require('../config/taxonomy');
const tests = require('../services/testService');
const roadmaps = require('../services/roadmapService');
const logger = require('../utils/logger');

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

function createTestsRouter({ generationQueue }) {
  const router = express.Router();
  router.use(authenticate);

  router.post(
    '/start',
    validate({
      body: z
        .object({
          subject: z.enum(SUBJECTS),
          subtopic: z.string().min(1).max(60).optional(),
          count: z.number().int().min(5).max(40).default(10),
          timeLimitMinutes: z.number().min(1).max(180).optional(),
        })
        .strict(),
    }),
    asyncHandler(async (req, res) => {
      const attempt = await tests.startTest({ user: req.user, ...req.body, generationQueue });
      res.status(attempt.resumed ? 200 : 201).json({ test: attempt });
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const rows = await TestAttempt.find({ user: req.user._id }).sort({ startedAt: -1 }).limit(100).lean();
      res.json({
        tests: rows.map((r) => ({
          id: String(r._id),
          subject: r.subject,
          focusSubtopic: r.focusSubtopic || null,
          status: r.status,
          score: r.score ?? null,
          questionCount: r.questions.length,
          startedAt: r.startedAt,
          submittedAt: r.submittedAt || null,
        })),
      });
    }),
  );

  router.get(
    '/:id',
    validate({ params: z.object({ id: objectId }) }),
    asyncHandler(async (req, res) => {
      res.json({ test: await tests.getResult({ user: req.user, attemptId: req.params.id }) });
    }),
  );

  router.post(
    '/:id/submit',
    validate({
      params: z.object({ id: objectId }),
      body: z
        .object({
          answers: z
            .array(z.object({ questionId: objectId, selectedIndex: z.number().int().min(0).max(3) }).strict())
            .max(100),
        })
        .strict(),
    }),
    asyncHandler(async (req, res) => {
      const result = await tests.submitTest({ user: req.user, attemptId: req.params.id, answers: req.body.answers });

      // Retest -> reschedule: if the student already has a roadmap, refresh it from the new scores.
      // A quiz taken from the roadmap itself must not replace that roadmap, or it would reset the plan it belongs to.
      let roadmapVersion = null;
      if (req.user.settings.autoReschedule && !result.focusSubtopic) {
        try {
          await roadmaps.getActive(req.user);
          const fresh = await roadmaps.createRoadmap({ user: req.user, reason: 'retest' });
          roadmapVersion = fresh.version;
        } catch (err) {
          if (err.status !== 404 && err.status !== 409) logger.error({ err }, 'auto reschedule failed');
        }
      }
      res.json({ result: { ...result, roadmapVersion } });
    }),
  );

  return router;
}

module.exports = { createTestsRouter };
