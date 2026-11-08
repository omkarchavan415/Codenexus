'use strict';

const mongoose = require('mongoose');

const attemptQuestionSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    subtopic: { type: String, required: true },
    difficulty: { type: String, required: true },
    selectedIndex: { type: Number, default: null },
    correct: { type: Boolean, default: null },
  },
  { _id: false },
);

const subtopicScoreSchema = new mongoose.Schema(
  {
    subtopic: String,
    correct: Number,
    total: Number,
    score: Number,
    levelBefore: Number,
    levelAfter: Number,
  },
  { _id: false },
);

const testAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true },
    // set for a quiz started from the roadmap: the attempt covers this one subtopic
    focusSubtopic: { type: String, default: null },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    questions: { type: [attemptQuestionSchema], default: [] },
    timeLimitSeconds: { type: Number, default: null },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    timedOut: { type: Boolean, default: false },
    score: { type: Number },
    correctCount: { type: Number },
    subtopicScores: { type: [subtopicScoreSchema], default: [] },
    fallbackUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

testAttemptSchema.index({ user: 1, subject: 1, status: 1, startedAt: -1 });
testAttemptSchema.index({ user: 1, focusSubtopic: 1, submittedAt: -1 });
testAttemptSchema.index({ user: 1, 'questions.question': 1 });

module.exports = mongoose.models.TestAttempt || mongoose.model('TestAttempt', testAttemptSchema);
