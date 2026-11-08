'use strict';

const mongoose = require('mongoose');
const { SUBJECTS, WEIGHTS } = require('../config/taxonomy');

/** A curated requirement profile: which subjects matter for a company and how much. */
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, default: 'Software Engineer', trim: true },
    description: { type: String, default: '', maxlength: 1000 },
    skills: {
      type: [
        new mongoose.Schema(
          {
            subject: { type: String, enum: SUBJECTS, required: true },
            weight: { type: String, enum: WEIGHTS, required: true },
          },
          { _id: false },
        ),
      ],
      validate: {
        validator: (v) => new Set(v.map((s) => s.subject)).size === v.length,
        message: 'A subject can appear only once in a company profile',
      },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
