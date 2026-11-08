'use strict';

const mongoose = require('mongoose');
const { SUBJECTS, DIFFICULTIES, isValidSubtopic } = require('../config/taxonomy');

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: {
      type: String,
      required: true,
      unique: true,
      match: [/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/?$/, 'url must be a leetcode.com/problems/<slug> link'],
    },
    platform: { type: String, default: 'leetcode' },
    subject: { type: String, enum: SUBJECTS, required: true },
    subtopic: { type: String, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

problemSchema.index({ subject: 1, subtopic: 1, difficulty: 1, active: 1 });

problemSchema.pre('validate', function checkSubtopic(next) {
  if (!isValidSubtopic(this.subject, this.subtopic)) this.invalidate('subtopic', 'Subtopic does not belong to the subject');
  next();
});

module.exports = mongoose.models.Problem || mongoose.model('Problem', problemSchema);
