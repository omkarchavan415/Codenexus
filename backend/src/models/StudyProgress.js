'use strict';

const mongoose = require('mongoose');

/** A student marking a resource or practical as done. */
const studyProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyItem', required: true },
  doneAt: { type: Date, default: Date.now },
});

studyProgressSchema.index({ user: 1, item: 1 }, { unique: true });

module.exports = mongoose.models.StudyProgress || mongoose.model('StudyProgress', studyProgressSchema);
