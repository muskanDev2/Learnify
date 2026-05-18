const mongoose = require('mongoose');
const { getEnv } = require('./env');

async function connectDatabase() {
  const { mongoUri } = getEnv();

  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log('MongoDB connected');
}

module.exports = { connectDatabase };
