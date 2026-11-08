'use strict';

const express = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/errors');
const roadmaps = require('../services/roadmapService');
const { loadLevels, subjectScores } = require('../services/skillService');
const { loadProgress } = require('../services/progressService');
const User = require('../models/User');
const { updateStreak } = require('../utils/dates');
const { TAXONOMY, subtopicKeys, subtopicLabel } = require('../config/taxonomy');

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

const router = express.Router();
router.use(authenticate);

router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const roadmap = await roadmaps.createRoadmap({ user: req.user, reason: 'initial' });
    res.status(201).json({ roadmap: await roadmaps.present(req.user, roadmap) });
  }),
);

router.post(
  '/reschedule',
  asyncHandler(async (req, res) => {
    const roadmap = await roadmaps.createRoadmap({ user: req.user, reason: 'reschedule' });
    res.status(201).json({ roadmap: await roadmaps.present(req.user, roadmap) });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const roadmap = await roadmaps.getActive(req.user);
    res.json({ roadmap: await roadmaps.present(req.user, roadmap) });
  }),
);

router.get(
  '/versions',
  asyncHandler(async (req, res) => {
    res.json({ versions: await roadmaps.listVersions(req.user) });
  }),
);

router.get(
  '/versions/:version',
  validate({ params: z.object({ version: z.coerce.number().int().min(1) }) }),
  asyncHandler(async (req, res) => {
    const roadmap = await roadmaps.getVersion(req.user, req.params.version);
    res.json({ roadmap: await roadmaps.present(req.user, roadmap) });
  }),
);

router.get(
  '/today',
  asyncHandler(async (req, res) => {
    res.json({ plan: await roadmaps.dailyPlan({ user: req.user }) });
  }),
);

router.put(
  '/problems/:problemId/solved',
  validate({ params: z.object({ problemId: objectId }), body: z.object({ solved: z.boolean() }).strict() }),
  asyncHandler(async (req, res) => {
    const result = await roadmaps.setProblemSolved({ user: req.user, problemId: req.params.problemId, solved: req.body.solved });
    if (req.body.solved) {
      const fresh = await User.findById(req.user._id);
      fresh.streak = updateStreak(fresh.streak, new Date(), fresh.timezone);
      await fresh.save();
    }
    res.json(result);
  }),
);

router.put(
  '/items/:itemId/done',
  validate({ params: z.object({ itemId: objectId }), body: z.object({ done: z.boolean() }).strict() }),
  asyncHandler(async (req, res) => {
    const result = await roadmaps.setItemDone({ user: req.user, itemId: req.params.itemId, done: req.body.done });
    if (req.body.done) {
      const fresh = await User.findById(req.user._id);
      fresh.streak = updateStreak(fresh.streak, new Date(), fresh.timezone);
      await fresh.save();
    }
    res.json(result);
  }),
);

module.exports = router;

/** Skill levels and score history, mounted separately under /api. */
const insights = express.Router();
insights.use(authenticate);

insights.get(
  '/skills',
  asyncHandler(async (req, res) => {
    const levels = await loadLevels(req.user._id);
    const scores = subjectScores(levels);
    res.json({
      subjects: Object.keys(TAXONOMY).map((subject) => ({
        subject,
        label: TAXONOMY[subject].label,
        score: scores[subject],
        subtopics: subtopicKeys(subject).map((key) => ({ key, label: subtopicLabel(subject, key), level: (levels[subject] || {})[key] ?? null })),
      })),
    });
  }),
);

insights.get(
  '/progress',
  asyncHandler(async (req, res) => {
    res.json(await loadProgress(req.user._id));
  }),
);

module.exports.insights = insights;
