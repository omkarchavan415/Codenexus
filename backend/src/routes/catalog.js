'use strict';

const express = require('express');
const Company = require('../models/Company');
const { TAXONOMY } = require('../config/taxonomy');
const { asyncHandler } = require('../utils/errors');
const cache = require('../services/cache');

const router = express.Router();

router.get('/subjects', (req, res) => {
  res.json({
    subjects: Object.entries(TAXONOMY).map(([key, v]) => ({ key, label: v.label, subtopics: v.subtopics })),
  });
});

router.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const companies = await cache.remember('companies:active', 300, async () => {
      const rows = await Company.find({ active: true }).sort({ name: 1 }).lean();
      return rows.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, role: c.role, description: c.description, skills: c.skills }));
    });
    res.json({ companies });
  }),
);

module.exports = router;
