'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { env } = require('../config/env');
const Company = require('../models/Company');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler, badRequest, unauthorized } = require('../utils/errors');
const { dayKey } = require('../utils/dates');
const { addDays } = require('../services/planner');
const { activeStreak } = require('../utils/dates');
const { loadLevels, subjectScores } = require('../services/skillService');
const { passwordSchema } = require('./auth');
const authService = require('../services/authService');
const roadmaps = require('../services/roadmapService');
const { TAXONOMY, subtopicKeys, subtopicLabel } = require('../config/taxonomy');
const { isMastered } = require('../services/skill');

const router = express.Router();
router.use(authenticate);

const isTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
};

router.get('/', (req, res) => {
  res.json({ user: req.user.toPublic() });
});

router.patch(
  '/',
  validate({
    body: z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        timezone: z.string().refine(isTimezone, 'Unknown timezone').optional(),
        settings: z.object({ autoReschedule: z.boolean().optional(), timerDefault: z.boolean().optional() }).optional(),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const { name, timezone, settings } = req.body;
    if (name) req.user.name = name;
    if (timezone) req.user.timezone = timezone;
    if (settings) {
      if (settings.autoReschedule !== undefined) req.user.settings.autoReschedule = settings.autoReschedule;
      if (settings.timerDefault !== undefined) req.user.settings.timerDefault = settings.timerDefault;
    }
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  }),
);

router.put(
  '/goal',
  validate({
    body: z
      .object({
        companySlug: z.string().trim().toLowerCase().min(1),
        deadlineDays: z.number().int().min(1).max(365),
        hoursPerDay: z.number().min(0.5).max(12),
      })
      .strict(),
  }),
  asyncHandler(async (req, res) => {
    const company = await Company.findOne({ slug: req.body.companySlug, active: true });
    if (!company) throw badRequest('Unknown company', 'bad_company');
    const today = dayKey(new Date(), req.user.timezone);
    req.user.goal = {
      company: company._id,
      deadline: addDays(today, req.body.deadlineDays - 1),
      hoursPerDay: req.body.hoursPerDay,
      setAt: new Date(),
    };
    await req.user.save();
    res.json({ user: req.user.toPublic(), company: { id: String(company._id), name: company.name, slug: company.slug, role: company.role } });
  }),
);

router.post(
  '/password',
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }).strict() }),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is incorrect', 'bad_credentials');
    }
    user.passwordHash = await bcrypt.hash(req.body.newPassword, env.BCRYPT_ROUNDS);
    await user.save();
    await authService.revokeAllForUser(user._id);
    const tokens = { accessToken: authService.signAccess(user) };
    res.json({ ...tokens, message: 'Password changed. Other sessions were signed out.' });
  }),
);

/** Everything the dashboard needs in one call. */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const now = new Date();
    const levels = await loadLevels(user._id);
    const scores = subjectScores(levels);

    const subjects = Object.keys(TAXONOMY).map((subject) => ({
      subject,
      label: TAXONOMY[subject].label,
      score: scores[subject],
      tested: Boolean(levels[subject] && Object.keys(levels[subject]).length),
      subtopics: subtopicKeys(subject).map((key) => ({
        key,
        label: subtopicLabel(subject, key),
        level: (levels[subject] || {})[key] ?? null,
        mastered: isMastered((levels[subject] || {})[key] ?? 0),
      })),
    }));

    let company = null;
    if (user.goal && user.goal.company) {
      const c = await Company.findById(user.goal.company).lean();
      if (c) company = { id: String(c._id), name: c.name, slug: c.slug, role: c.role };
    }
    const daysLeft = user.goal && user.goal.deadline
      ? Math.max(0, Math.round((Date.parse(`${user.goal.deadline}T00:00:00Z`) - Date.parse(`${dayKey(now, user.timezone)}T00:00:00Z`)) / 86400000) + 1)
      : null;

    let roadmap = null;
    try {
      const active = await roadmaps.getActive(user);
      const summary = await roadmaps.present(user, active);
      roadmap = { version: summary.version, progressPercent: summary.progressPercent, mastered: summary.mastered };
    } catch (err) {
      if (!(err.status === 404)) throw err;
    }

    res.json({
      user: user.toPublic(),
      company,
      daysLeft,
      streak: { current: activeStreak(user.streak, now, user.timezone), longest: user.streak.longest || 0 },
      subjects,
      roadmap,
    });
  }),
);

module.exports = router;
