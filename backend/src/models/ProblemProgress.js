'use strict';

const mongoose = require('mongoose');

const problemProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    solvedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

problemProgressSchema.index({ user: 1, problem: 1 }, { unique: true });

module.exports = mongoose.models.ProblemProgress || mongoose.model('ProblemProgress', problemProgressSchema);
