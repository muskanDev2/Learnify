const dotenv = require('dotenv');

dotenv.config();

const required = ['MONGO_URI'];

function getEnv() {
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI.trim(),
    clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
    jwtSecret: process.env.JWT_SECRET || '',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

module.exports = { getEnv };
