'use strict';

const mongoose = require('mongoose');

/** One row per student per subtopic: the 0-1 skill level that every test nudges. */
const skillSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    subtopic: { type: String, required: true },
    level: { type: Number, required: true, min: 0, max: 1 },
    attempts: { type: Number, default: 0 },
    lastScore: { type: Number },
  },
  { timestamps: true },
);

skillSchema.index({ user: 1, subject: 1, subtopic: 1 }, { unique: true });

module.exports = mongoose.models.Skill || mongoose.model('Skill', skillSchema);
