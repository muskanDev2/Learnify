const AssignmentSubmission = require('../models/AssignmentSubmission');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const QuizAttempt = require('../models/QuizAttempt');
const { createNotification } = require('./notification.service');

const reminderWindows = [
  { key: '7d', label: 'in 7 days', minMs: 6.5 * 24 * 60 * 60 * 1000, maxMs: 7.5 * 24 * 60 * 60 * 1000 },
  { key: '48h', label: 'in 48 hours', minMs: 42 * 60 * 60 * 1000, maxMs: 54 * 60 * 60 * 1000 },
  { key: '24h', label: 'in 24 hours', minMs: 18 * 60 * 60 * 1000, maxMs: 30 * 60 * 60 * 1000 },
  { key: '1h', label: 'in 1 hour', minMs: 30 * 60 * 1000, maxMs: 90 * 60 * 1000 },
];

function flattenCourseItems(course) {
  return (course.modules || []).flatMap((module) =>
    (module.items || []).map((item) => ({
      ...item,
      moduleTitle: module.title,
    })),
  );
}

function buildActionUrl(courseId, item) {
  const type = item.type === 'quiz' ? 'quizId' : 'assignmentId';
  return `/courses?courseId=${courseId}&${type}=${item.id}`;
}

function getDueDate(item) {
  if (!item.dueAt && !item.dueDate) return null;
  const dueDate = new Date(item.dueAt || item.dueDate);
  return Number.isNaN(dueDate.getTime()) ? null : dueDate;
}

function getReminderWindow(diffMs) {
  return reminderWindows.find((window) => diffMs >= window.minMs && diffMs <= window.maxMs);
}

async function hasCompletedItem(user, course, item) {
  if (item.type === 'quiz') {
    return QuizAttempt.exists({ student: user._id, course: course._id, quizItemId: String(item.id) });
  }

  return AssignmentSubmission.exists({
    student: user._id,
    course: course._id,
    assignmentItemId: String(item.id),
  });
}

async function generateAcademicRemindersForUser(user) {
  if (String(user.role || '').toLowerCase() !== 'student') return;

  const enrollments = await Enrollment.find({
    $or: [{ student: user._id }, { studentEmail: String(user.email || '').toLowerCase() }],
    status: { $ne: 'dropped' },
  }).select('course courseId');

  if (!enrollments.length) return;

  const courseIds = enrollments.map((enrollment) => enrollment.courseId).filter(Boolean);
  const courses = await Course.find({ id: { $in: courseIds } });
  const now = Date.now();

  for (const course of courses) {
    const schedulableItems = flattenCourseItems(course).filter((item) => ['assignment', 'quiz'].includes(item.type));

    for (const item of schedulableItems) {
      const dueDate = getDueDate(item);
      if (!dueDate) continue;

      const completed = await hasCompletedItem(user, course, item);
      if (completed) continue;

      const diffMs = dueDate.getTime() - now;
      const window = getReminderWindow(diffMs);
      const isOverdue = diffMs < 0;

      if (!window && !isOverdue) continue;

      const itemLabel = item.title || (item.type === 'quiz' ? 'Quiz' : 'Assignment');
      const notificationType = isOverdue
        ? item.type === 'quiz'
          ? 'quiz_overdue'
          : 'assignment_overdue'
        : item.type === 'quiz'
          ? 'quiz_reminder'
          : 'assignment_due';
      const dedupeKey = `${notificationType}:${course.id}:${item.id}:${isOverdue ? 'overdue' : window.key}`;

      await createNotification(user._id, {
        title: isOverdue
          ? `${item.type === 'quiz' ? 'Quiz' : 'Assignment'} deadline passed`
          : `${item.type === 'quiz' ? 'Quiz' : 'Assignment'} reminder`,
        message: isOverdue
          ? `${itemLabel} submission deadline has passed.`
          : `${itemLabel} is due ${window.label}.`,
        notificationType,
        relatedEntityId: item.id,
        relatedEntityType: item.type,
        courseId: course.id,
        dedupeKey,
        actionUrl: buildActionUrl(course.id, item),
      });
    }
  }
}

module.exports = { generateAcademicRemindersForUser };
