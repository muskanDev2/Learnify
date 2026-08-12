const User = require('../models/User');

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const name = process.env.SEED_ADMIN_NAME?.trim();

  // No hardcoded demo admin — only seed when explicitly configured via env.
  if (!email || !password || !name) return;

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) return;

  const existingSeedUser = await User.findOne({ email });
  if (existingSeedUser) return;

  await User.create({
    name,
    email,
    password,
    role: 'admin',
    active: true,
  });

  console.log('Seed admin user created from SEED_ADMIN_* env');
}

module.exports = { seedAdminUser };
