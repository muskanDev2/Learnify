const mongoose = require('mongoose');
const dns = require('dns');
const { getEnv } = require('./env');

async function connectDatabase() {
  const { mongoUri } = getEnv();

  mongoose.set('strictQuery', true);
  // Atlas mongodb+srv URLs need SRV DNS lookup. Some local networks refuse the
  // default DNS query, so use stable public resolvers before connecting.
  dns.setServers(['8.8.8.8', '1.1.1.1']);

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log('MongoDB connected');
}

module.exports = { connectDatabase };
