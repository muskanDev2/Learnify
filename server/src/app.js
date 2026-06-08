const express = require('express');
const path = require('path');
const cors = require('cors');
const { getEnv } = require('./config/env');
const apiRoutes = require('./routes');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  const { clientUrls } = getEnv();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (clientUrls.includes(origin)) return callback(null, true);
        if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
