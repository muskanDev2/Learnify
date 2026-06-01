const AssignmentSubmission = require('../models/AssignmentSubmission');
const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const QuizAttempt = require('../models/QuizAttempt');

function getCourseItems(course) {
  return (course.modules || []).flatMap((module) =>
    (module.items || []).map((item) => ({
      ...item,
      moduleId: module.id,
    })),
  );
}

async function resolveCourseById(courseId) {
  const numericCourseId = Number(courseId);
  if (!numericCourseId) return null;
  return Course.findOne({ id: numericCourseId });
}

async function ensureActiveEnrollment(student, course) {
  const studentEmail = String(student.email || '').toLowerCase();

  return Enrollment.findOneAndUpdate(
    {
      $or: [
        { student: student._id, course: course._id },
        { studentEmail, courseId: course.id },
      ],
    },
    {
      $set: {
        student: student._id,
        course: course._id,
        studentEmail,
        courseId: course.id,
        status: 'active',
        lastActivityAt: new Date(),
      },
      $setOnInsert: {
        enrolledAt: new Date(),
      },
    },
    { returnDocument: 'after', upsert: true },
  );
}

async function recalculateCourseProgress(student, course) {
  const enrollment = await ensureActiveEnrollment(student, course);
  const items = getCourseItems(course);
  const totalItems = items.length;
  const assignmentItems = items.filter((item) => item.type === 'assignment');

  const completedRows = await Progress.find({
    student: student._id,
    course: course._id,
    completed: true,
  });
  const completedIds = new Set(completedRows.map((row) => String(row.itemId)));

  const quizAttempts = await QuizAttempt.find({
    student: student._id,
    course: course._id,
  });
  quizAttempts.forEach((attempt) => {
    if (attempt.percentage >= 50 || attempt.status === 'submitted' || attempt.status === 'timed_out') {
      completedIds.add(String(attempt.quizItemId));
    }
  });

  const submissions = await AssignmentSubmission.find({
    student: student._id,
    course: course._id,
  });
  submissions.forEach((submission) => {
    completedIds.add(String(submission.assignmentItemId));
  });

  const completedItems = items.filter((item) => completedIds.has(String(item.id))).length;
  const progressPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
  const quizAverage = quizAttempts.length
    ? Math.round(
        quizAttempts.reduce((sum, attempt) => sum + (Number(attempt.percentage) || 0), 0) /
          quizAttempts.length,
      )
    : 0;

  const progress = await CourseProgress.findOneAndUpdate(
    { student: student._id, course: course._id },
    {
      $set: {
        student: student._id,
        course: course._id,
        courseId: course.id,
        enrollment: enrollment._id,
        totalItems,
        completedItems,
        progressPercent,
        quizAverage,
        assignmentSubmittedCount: submissions.length,
        assignmentTotalCount: assignmentItems.length,
        lastActivityAt: new Date(),
      },
    },
    { returnDocument: 'after', upsert: true },
  );

  await Enrollment.updateOne(
    { _id: enrollment._id },
    {
      $set: {
        progressPercent,
        lastActivityAt: new Date(),
        ...(progressPercent >= 100 ? { status: 'completed', completedAt: new Date() } : {}),
      },
    },
  );

  return progress;
}

async function getProgressMap(filter = {}) {
  const rows = await Progress.find(filter);
  return rows.reduce((map, row) => {
    const email = row.studentEmail;
    const courseId = String(row.courseId);
    const itemId = String(row.itemId);

    if (!map[email]) map[email] = {};
    if (!map[email][courseId]) map[email][courseId] = {};

    map[email][courseId][itemId] = Boolean(row.completed);
    return map;
  }, {});
}

module.exports = {
  ensureActiveEnrollment,
  getCourseItems,
  getProgressMap,
  recalculateCourseProgress,
  resolveCourseById,
};
