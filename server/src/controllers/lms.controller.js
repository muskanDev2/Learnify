const LmsSnapshot = require('../models/LmsSnapshot');

const SNAPSHOT_KEY = 'main';

function emptySnapshot() {
  return {
    courses: [],
    enrollments: {},
    studentProgress: {},
  };
}

async function getSnapshotDocument() {
  return LmsSnapshot.findOneAndUpdate(
    { key: SNAPSHOT_KEY },
    { $setOnInsert: { key: SNAPSHOT_KEY, ...emptySnapshot() } },
    { returnDocument: 'after', upsert: true },
  );
}

async function getSnapshot(req, res, next) {
  try {
    const snapshot = await getSnapshotDocument();

    return res.json({
      success: true,
      data: {
        courses: snapshot.courses || [],
        enrollments: snapshot.enrollments || {},
        studentProgress: snapshot.studentProgress || {},
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function syncSnapshot(req, res, next) {
  try {
    const courses = Array.isArray(req.body.courses) ? req.body.courses : [];
    const enrollments =
      req.body.enrollments && typeof req.body.enrollments === 'object' ? req.body.enrollments : {};
    const studentProgress =
      req.body.studentProgress && typeof req.body.studentProgress === 'object'
        ? req.body.studentProgress
        : {};

    const snapshot = await LmsSnapshot.findOneAndUpdate(
      { key: SNAPSHOT_KEY },
      {
        $set: {
          courses,
          enrollments,
          studentProgress,
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    return res.json({
      success: true,
      message: 'LMS data synced successfully.',
      data: {
        courses: snapshot.courses || [],
        enrollments: snapshot.enrollments || {},
        studentProgress: snapshot.studentProgress || {},
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSnapshot, syncSnapshot };
