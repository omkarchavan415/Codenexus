'use strict';

const mongoose = require('mongoose');
const { SUBJECTS, isValidSubtopic } = require('../config/taxonomy');

/**
 * Something to do for a subtopic that is not a LeetCode problem:
 *   resource   a link to read or watch
 *   practical  a hands-on exercise described in text (optionally with a link)
 */
const studyItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['resource', 'practical'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1500, default: '' },
    url: {
      type: String,
      trim: true,
      default: '',
      validate: { validator: (v) => !v || /^https?:\/\/\S+$/.test(v), message: 'url must start with http:// or https://' },
    },
    minutes: { type: Number, required: true, min: 5, max: 240 },
    subject: { type: String, enum: SUBJECTS, required: true },
    subtopic: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

studyItemSchema.index({ subject: 1, subtopic: 1, type: 1, title: 1 }, { unique: true });
studyItemSchema.index({ subject: 1, subtopic: 1, active: 1 });

studyItemSchema.pre('validate', function check(next) {
  if (!isValidSubtopic(this.subject, this.subtopic)) this.invalidate('subtopic', 'Subtopic does not belong to the subject');
  if (this.type === 'resource' && !this.url) this.invalidate('url', 'A resource needs a link');
  if (this.type === 'practical' && !this.description) this.invalidate('description', 'A practical needs instructions');
  next();
});

module.exports = mongoose.models.StudyItem || mongoose.model('StudyItem', studyItemSchema);
