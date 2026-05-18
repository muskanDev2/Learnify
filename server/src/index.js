const { getEnv } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function startServer() {
  try {
    const { port } = getEnv();
    await connectDatabase();

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
