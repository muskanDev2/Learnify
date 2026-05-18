const mongoose = require('mongoose');
const { getEnv } = require('./env');

async function connectDatabase() {
  const { mongoUri } = getEnv();

  mongoose.set('strictQuery', true);

  const uri = mongoUri.includes('/?')
    ? mongoUri.replace('/?', '/learnify?')
    : mongoUri.endsWith('/')
      ? `${mongoUri}learnify`
      : mongoUri.includes('.net/') && !mongoUri.match(/\.net\/\w/)
        ? mongoUri.replace('.net/', '.net/learnify')
        : mongoUri;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log('MongoDB connected');
}

module.exports = { connectDatabase };
