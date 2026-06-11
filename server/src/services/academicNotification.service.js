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

async function generateStudentReminders(user) {
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

async function generateInstructorAlerts(user) {
  const courses = await Course.find({ ownerEmail: String(user.email || '').toLowerCase() });
  const now = Date.now();

  for (const course of courses) {
    const activeEnrollmentCount = await Enrollment.countDocuments({
      courseId: course.id,
      status: { $ne: 'dropped' },
    });
    const items = flattenCourseItems(course).filter((item) => ['assignment', 'quiz'].includes(item.type));

    for (const item of items) {
      const dueDate = getDueDate(item);
      const isPastDue = dueDate && dueDate.getTime() < now;
      const itemLabel = item.title || (item.type === 'quiz' ? 'Quiz' : 'Assignment');

      if (isPastDue) {
        await createNotification(user._id, {
          title: `${item.type === 'quiz' ? 'Quiz' : 'Assignment'} deadline reached`,
          message: `${itemLabel} in ${course.title} has reached its deadline.`,
          notificationType: item.type === 'quiz' ? 'instructor_quiz_deadline_reached' : 'instructor_assignment_deadline_reached',
          relatedEntityId: item.id,
          relatedEntityType: item.type,
          courseId: course.id,
          dedupeKey: `instructor_deadline_reached:${course.id}:${item.type}:${item.id}`,
          actionUrl: buildActionUrl(course.id, item),
        });
      }

      if (item.type === 'assignment') {
        const pendingSubmissionCount = await AssignmentSubmission.countDocuments({
          course: course._id,
          assignmentItemId: String(item.id),
          status: { $in: ['submitted', 'late', 'resubmitted'] },
        });

        if (pendingSubmissionCount > 0) {
          await createNotification(user._id, {
            title: 'Submissions pending review',
            message: `${pendingSubmissionCount} submission${pendingSubmissionCount === 1 ? '' : 's'} for ${itemLabel} ${pendingSubmissionCount === 1 ? 'is' : 'are'} waiting for grading.`,
            notificationType: 'submissions_pending_review',
            relatedEntityId: item.id,
            relatedEntityType: 'assignment',
            courseId: course.id,
            dedupeKey: `submissions_pending_review:${course.id}:${item.id}:${pendingSubmissionCount}`,
            actionUrl: buildActionUrl(course.id, item),
          });
        }

        if (isPastDue && activeEnrollmentCount > 0) {
          const submittedStudentCount = await AssignmentSubmission.distinct('student', {
            course: course._id,
            assignmentItemId: String(item.id),
          });
          const missingCount = Math.max(0, activeEnrollmentCount - submittedStudentCount.length);

          if (missingCount > 0) {
            await createNotification(user._id, {
              title: 'Students missing assignment submission',
              message: `${missingCount} student${missingCount === 1 ? '' : 's'} did not submit ${itemLabel} before the deadline.`,
              notificationType: 'instructor_missing_submissions',
              relatedEntityId: item.id,
              relatedEntityType: 'assignment',
              courseId: course.id,
              dedupeKey: `instructor_missing_submissions:${course.id}:${item.id}:${missingCount}`,
              actionUrl: buildActionUrl(course.id, item),
            });
          }
        }
      }
    }
  }
}

async function generateAdminAlerts(user) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [courseCount, activeEnrollmentCount] = await Promise.all([
    Course.countDocuments(),
    Enrollment.countDocuments({ status: { $ne: 'dropped' } }),
  ]);

  await createNotification(user._id, {
    title: 'Daily platform activity summary',
    message: `Learnify currently has ${courseCount} course${courseCount === 1 ? '' : 's'} and ${activeEnrollmentCount} active enrollment${activeEnrollmentCount === 1 ? '' : 's'}.`,
    notificationType: 'admin_platform_summary',
    relatedEntityType: 'system',
    dedupeKey: `admin_platform_summary:${todayKey}`,
    actionUrl: '/dashboard?tab=reports',
  });
}

async function generateAcademicRemindersForUser(user) {
  const role = String(user.role || '').toLowerCase();
  if (role === 'student') return generateStudentReminders(user);
  if (role === 'instructor') return generateInstructorAlerts(user);
  if (role === 'admin') return generateAdminAlerts(user);
  return null;
}

module.exports = { generateAcademicRemindersForUser };
