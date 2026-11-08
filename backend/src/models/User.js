'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    settings: {
      autoReschedule: { type: Boolean, default: true },
      timerDefault: { type: Boolean, default: false },
    },
    goal: {
      company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
      deadline: { type: String }, // 'YYYY-MM-DD' in the student's timezone
      hoursPerDay: { type: Number, min: 0.5, max: 12 },
      setAt: { type: Date },
    },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDay: { type: String },
    },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    timezone: this.timezone,
    settings: this.settings,
    goal: this.goal && this.goal.deadline
      ? {
          company: this.goal.company ? String(this.goal.company) : null,
          deadline: this.goal.deadline,
          hoursPerDay: this.goal.hoursPerDay,
          setAt: this.goal.setAt,
        }
      : null,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
