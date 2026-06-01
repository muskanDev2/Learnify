const LmsSnapshot = require('../models/LmsSnapshot');
const Progress = require('../models/Progress');
const CourseProgress = require('../models/CourseProgress');
const { getProgressMap, recalculateCourseProgress, resolveCourseById } = require('../utils/lmsProgress');

async function migrateSnapshotProgressIfEmpty() {
  const count = await Progress.countDocuments();
  if (count > 0) return;

  const snapshot = await LmsSnapshot.findOne({ key: 'main' });
  const snapshotProgress =
    snapshot?.studentProgress && typeof snapshot.studentProgress === 'object'
      ? snapshot.studentProgress
      : {};

  const docs = [];

  Object.entries(snapshotProgress).forEach(([studentEmail, courses]) => {
    Object.entries(courses || {}).forEach(([courseId, items]) => {
      Object.entries(items || {}).forEach(([itemId, completed]) => {
        docs.push({
          studentEmail: String(studentEmail).toLowerCase(),
          courseId: Number(courseId),
          itemId: Number(itemId),
          completed: Boolean(completed),
        });
      });
    });
  });

  if (docs.length) {
    await Progress.insertMany(docs, { ordered: false }).catch(() => {});
  }
}

async function listProgress(req, res, next) {
  try {
    await migrateSnapshotProgressIfEmpty();

    return res.json({
      success: true,
      data: await getProgressMap(),
    });
  } catch (error) {
    return next(error);
  }
}

async function saveItemProgress(req, res, next) {
  try {
    const studentEmail = String(req.user.email || '').toLowerCase();
    const courseId = Number(req.body.courseId);
    const itemId = req.body.itemId;
    const completed = req.body.completed !== false;

    if (!courseId || !itemId) {
      return res.status(400).json({
        success: false,
        message: 'Course id and item id are required.',
      });
    }

    const course = await resolveCourseById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    await Progress.findOneAndUpdate(
      {
        $or: [
          { student: req.user._id, course: course._id, itemId },
          { studentEmail, courseId, itemId },
        ],
      },
      {
        $set: {
          student: req.user._id,
          course: course._id,
          studentEmail,
          courseId,
          itemId,
          itemType: req.body.itemType || 'content',
          completed,
          completedAt: completed ? new Date() : null,
          lastActivityAt: new Date(),
        },
      },
      { returnDocument: 'after', upsert: true },
    );
    await recalculateCourseProgress(req.user, course);

    return res.json({
      success: true,
      message: 'Progress saved successfully.',
      data: await getProgressMap(),
    });
  } catch (error) {
    return next(error);
  }
}

async function openContent(req, res, next) {
  try {
    const course = await resolveCourseById(req.body.courseId);
    const itemId = req.body.itemId;

    if (!course || !itemId) {
      return res.status(400).json({ success: false, message: 'Course id and item id are required.' });
    }

    await Progress.findOneAndUpdate(
      {
        $or: [
          { student: req.user._id, course: course._id, itemId },
          { studentEmail: req.user.email, courseId: course.id, itemId },
        ],
      },
      {
        $setOnInsert: {
          student: req.user._id,
          course: course._id,
          studentEmail: req.user.email,
          courseId: course.id,
          itemId,
          itemType: 'content',
          openedAt: new Date(),
        },
        $set: { lastActivityAt: new Date() },
      },
      { returnDocument: 'after', upsert: true },
    );

    await recalculateCourseProgress(req.user, course);
    return res.json({ success: true, message: 'Content activity recorded.' });
  } catch (error) {
    return next(error);
  }
}

async function saveContentTime(req, res, next) {
  try {
    const course = await resolveCourseById(req.body.courseId);
    const itemId = req.body.itemId;
    const seconds = Math.max(0, Number(req.body.seconds) || 0);

    if (!course || !itemId) {
      return res.status(400).json({ success: false, message: 'Course id and item id are required.' });
    }

    await Progress.findOneAndUpdate(
      {
        $or: [
          { student: req.user._id, course: course._id, itemId },
          { studentEmail: req.user.email, courseId: course.id, itemId },
        ],
      },
      {
        $setOnInsert: {
          student: req.user._id,
          course: course._id,
          studentEmail: req.user.email,
          courseId: course.id,
          itemId,
          itemType: 'content',
          openedAt: new Date(),
        },
        $inc: { timeSpentSeconds: seconds },
        $set: { lastActivityAt: new Date() },
      },
      { returnDocument: 'after', upsert: true },
    );

    return res.json({ success: true, message: 'Content time saved.' });
  } catch (error) {
    return next(error);
  }
}

async function listMyProgress(req, res, next) {
  try {
    const rows = await CourseProgress.find({ student: req.user._id }).sort({ updatedAt: -1 });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
}

async function getMyCourseProgress(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const progress = await recalculateCourseProgress(req.user, course);
    return res.json({ success: true, data: progress });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMyCourseProgress,
  listMyProgress,
  listProgress,
  openContent,
  saveContentTime,
  saveItemProgress,
};
