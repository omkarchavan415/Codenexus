'use strict';

const mongoose = require('mongoose');
const { SUBJECTS, DIFFICULTIES, isValidSubtopic } = require('../config/taxonomy');
const { questionHash } = require('../services/questionGenerator');

const questionSchema = new mongoose.Schema(
  {
    subject: { type: String, enum: SUBJECTS, required: true },
    subtopic: { type: String, required: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    text: { type: String, required: true, trim: true, maxlength: 1500 },
    options: {
      type: [String],
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 4 && v.every((o) => typeof o === 'string' && o.trim()),
        message: 'A question needs exactly 4 non-empty options',
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
    source: { type: String, enum: ['seed', 'admin', 'import', 'gemini'], default: 'admin' },
    verified: { type: Boolean, default: false },
    hash: { type: String, required: true, unique: true },
    timesAsked: { type: Number, default: 0 },
    timesCorrect: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

questionSchema.index({ subject: 1, subtopic: 1, status: 1, difficulty: 1 });

questionSchema.pre('validate', function setHash(next) {
  if (!this.subtopic || !isValidSubtopic(this.subject, this.subtopic)) {
    this.invalidate('subtopic', 'Subtopic does not belong to the subject');
  }
  if (this.text && (!this.hash || this.isModified('text'))) this.hash = questionHash(this.text);
  next();
});

/** What a student may see before submitting: never the answer key or the explanation. */
questionSchema.methods.toClient = function toClient() {
  return {
    id: String(this._id),
    subject: this.subject,
    subtopic: this.subtopic,
    difficulty: this.difficulty,
    text: this.text,
    options: this.options,
  };
};

module.exports = mongoose.models.Question || mongoose.model('Question', questionSchema);
