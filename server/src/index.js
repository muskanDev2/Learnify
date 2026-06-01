const { getEnv } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');
const { seedAdminUser } = require('./utils/seedAdmin');

async function startServer() {
  try {
    const { port } = getEnv();
    await connectDatabase();
    await seedAdminUser();

    const app = createApp();

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
