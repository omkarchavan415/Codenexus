'use strict';

/**
 * Creates (or promotes) the first admin from ADMIN_EMAIL and ADMIN_PASSWORD.
 * Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' node scripts/createAdmin.js
 */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { env } = require('../src/config/env');
const User = require('../src/models/User');

async function main() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment');
  }
  if (env.ADMIN_PASSWORD.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');

  await mongoose.connect(env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Promoted ${email} to admin and reset the password`);
  } else {
    await User.create({ name: 'Admin', email, passwordHash, role: 'admin' });
    console.log(`Created admin ${email}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
