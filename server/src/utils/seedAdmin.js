const User = require('../models/User');

const defaultAdmin = {
  name: 'Learnify Admin',
  email: 'admin@learnify.test',
  password: 'Admin@123',
  role: 'admin',
  active: true,
};

async function seedAdminUser() {
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) return;

  const seedEmail = process.env.SEED_ADMIN_EMAIL || defaultAdmin.email;
  const existingSeedUser = await User.findOne({ email: seedEmail.toLowerCase() });
  if (existingSeedUser) return;

  await User.create({
    name: process.env.SEED_ADMIN_NAME || defaultAdmin.name,
    email: seedEmail,
    password: process.env.SEED_ADMIN_PASSWORD || defaultAdmin.password,
    role: 'admin',
    active: true,
  });

  console.log('Seed admin user created');
}

module.exports = { seedAdminUser };
