const { getEnv } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');
const AssignmentSubmission = require('./models/AssignmentSubmission');
const Course = require('./models/Course');
const LmsSnapshot = require('./models/LmsSnapshot');
const { seedAdminUser } = require('./utils/seedAdmin');
const { cleanupLegacyEmbeddedFilePayloads } = require('./utils/sanitizeCoursePayload');

async function runStartupMaintenance() {
  try {
    const result = await cleanupLegacyEmbeddedFilePayloads({ AssignmentSubmission, Course, LmsSnapshot });
    const removedCount =
      (result.courseDataUrls?.modifiedCount || 0) +
      (result.snapshotDataUrls?.modifiedCount || 0) +
      (result.submissionDataUrls?.modifiedCount || 0) +
      (result.compactedCourses?.modifiedCount || 0) +
      (result.compactedSnapshots?.modifiedCount || 0) +
      (result.compactedSubmissions?.modifiedCount || 0);

    if (removedCount > 0) {
      console.log(`Cleaned ${removedCount} legacy embedded file payload(s).`);
    }
  } catch (error) {
    console.warn('Legacy embedded file cleanup skipped:', error.message);
  }
}

async function startServer() {
  try {
    const { port } = getEnv();
    await connectDatabase();
    await runStartupMaintenance();
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
