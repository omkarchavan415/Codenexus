'use strict';

const Question = require('../models/Question');

/** MongoDB-backed store used by the question generator. */
const mongoQuestionStore = {
  async findExistingHashes(hashes) {
    if (!hashes.length) return new Set();
    const rows = await Question.find({ hash: { $in: hashes } }).select('hash').lean();
    return new Set(rows.map((r) => r.hash));
  },

  async insertPending(docs) {
    const saved = [];
    for (const doc of docs) {
      try {
        saved.push(await Question.create(doc));
      } catch (err) {
        // A concurrent job may have inserted the same question; the unique hash index wins.
        if (err.code !== 11000) throw err;
      }
    }
    return saved;
  },
};

module.exports = { mongoQuestionStore };
