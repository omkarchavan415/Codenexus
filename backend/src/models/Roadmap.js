'use strict';

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    id: String,
    type: { type: String, enum: ['study', 'problem', 'revision', 'review', 'resource', 'practical', 'quiz'] },
    title: String,
    minutes: Number,
    problemId: String,
    itemId: String,
    url: String,
    difficulty: String,
    description: String,
    // quiz tasks: a short test on one subtopic
    subject: String,
    subtopic: String,
    questionCount: Number,
    // a daily DSA problem on a day whose main topic is something else
    warmup: Boolean,
  },
  { _id: false },
);

const daySchema = new mongoose.Schema(
  {
    dayNumber: Number,
    date: String,
    subject: String,
    subtopic: String,
    label: String,
    tasks: [taskSchema],
  },
  { _id: false },
);

/** Every generation or reschedule is saved as a new version; only the newest is active. */
const roadmapSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    reason: { type: String, enum: ['initial', 'reschedule', 'retest', 'goal_change'], default: 'initial' },
    company: { id: mongoose.Schema.Types.ObjectId, name: String, slug: String, role: String },
    goal: { deadline: String, hoursPerDay: Number, daysRemaining: Number },
    startDate: { type: String, required: true },
    gaps: { type: [mongoose.Schema.Types.Mixed], default: [] },
    allocations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    skipped: { type: [mongoose.Schema.Types.Mixed], default: [] },
    schedule: { type: [daySchema], default: [] },
    mastered: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roadmapSchema.index({ user: 1, version: -1 }, { unique: true });
roadmapSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.models.Roadmap || mongoose.model('Roadmap', roadmapSchema);
