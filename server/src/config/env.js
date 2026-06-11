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
    uploadMaxFileMb: Number(process.env.UPLOAD_MAX_FILE_MB) || 250,
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
      folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'learnify/lms',
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    },
  };
}

module.exports = { getEnv };
