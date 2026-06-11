const Notification = require('../models/Notification');
const User = require('../models/User');

const duplicateWindowMs = 5 * 60 * 1000;
const defaultPreferences = {
  reminders: true,
  announcements: true,
  grades: true,
  courseMaterials: true,
};

function normalizeUserIds(users) {
  return [...new Set((Array.isArray(users) ? users : [users]).filter(Boolean).map((user) => String(user._id || user)))];
}

function getDuplicateFilter(userId, payload) {
  if (payload.dedupeKey) {
    return {
      user: userId,
      dedupeKey: payload.dedupeKey,
    };
  }

  return {
    user: userId,
    title: payload.title,
    message: payload.message,
    notificationType: payload.notificationType,
    relatedEntityId: payload.relatedEntityId ?? null,
    courseId: payload.courseId,
    relatedEntityType: payload.relatedEntityType || '',
    actionUrl: payload.actionUrl || '',
    createdAt: { $gte: new Date(Date.now() - duplicateWindowMs) },
  };
}

function getPreferenceKey(notificationType) {
  const type = String(notificationType || '').toLowerCase();
  if (type.includes('announcement')) return 'announcements';
  if (type.includes('grade') || type.includes('feedback')) return 'grades';
  if (type.includes('material') || type.includes('content')) return 'courseMaterials';
  if (type.includes('due') || type.includes('deadline') || type.includes('overdue') || type.includes('quiz') || type.includes('exam')) {
    return 'reminders';
  }
  return '';
}

function userAllowsNotification(user, payload) {
  const preferenceKey = getPreferenceKey(payload.notificationType);
  if (!preferenceKey) return true;
  const preferences = { ...defaultPreferences, ...(user.notificationPreferences || {}) };
  return preferences[preferenceKey] !== false;
}

async function createNotification(user, payload) {
  const [userId] = normalizeUserIds(user);
  if (!userId || !payload?.title || !payload?.message || !payload?.notificationType) return null;

  const [notification] = await createNotificationsForUsers([userId], payload);
  return notification || null;
}

async function createNotificationsForUsers(users, payload) {
  const userIds = normalizeUserIds(users);
  if (!userIds.length || !payload?.title || !payload?.message || !payload?.notificationType) return [];

  const targetUsers = await User.find({ _id: { $in: userIds }, active: { $ne: false } }).select('_id notificationPreferences');
  const preferenceAllowedUserIds = targetUsers
    .filter((user) => userAllowsNotification(user, payload))
    .map((user) => String(user._id));

  if (!preferenceAllowedUserIds.length) return [];

  const existing = await Notification.find({
    $or: preferenceAllowedUserIds.map((userId) => getDuplicateFilter(userId, payload)),
  }).select('user');
  const usersWithRecentDuplicate = new Set(existing.map((notification) => String(notification.user)));
  const targetUserIds = preferenceAllowedUserIds.filter((userId) => !usersWithRecentDuplicate.has(String(userId)));

  if (!targetUserIds.length) return [];

  return Notification.insertMany(
    targetUserIds.map((userId) => ({
      user: userId,
      title: payload.title,
      message: payload.message,
      notificationType: payload.notificationType,
      relatedEntityId: payload.relatedEntityId ?? null,
      courseId: payload.courseId,
      relatedEntityType: payload.relatedEntityType || '',
      dedupeKey: payload.dedupeKey || '',
      actionUrl: payload.actionUrl || '',
    })),
    { ordered: false },
  ).catch(() => []);
}

async function notifyRole(role, payload) {
  const users = await User.find({ role, active: { $ne: false } }).select('_id');
  return createNotificationsForUsers(users, payload);
}

async function notifyAdmins(payload) {
  return notifyRole('admin', payload);
}

async function notifyCourseStudents(course, payload, EnrollmentModel) {
  const enrollments = await EnrollmentModel.find({
    courseId: course.id,
    status: { $ne: 'dropped' },
  }).select('student studentEmail');

  const studentIds = enrollments.map((enrollment) => enrollment.student).filter(Boolean);
  const studentEmails = enrollments
    .map((enrollment) => String(enrollment.studentEmail || '').toLowerCase())
    .filter(Boolean);
  const usersByEmail = studentEmails.length
    ? await User.find({
        email: { $in: studentEmails },
        role: 'student',
        active: { $ne: false },
      }).select('_id')
    : [];

  return createNotificationsForUsers(
    [...studentIds, ...usersByEmail.map((user) => user._id)],
    payload,
  );
}

module.exports = {
  createNotification,
  createNotificationsForUsers,
  notifyAdmins,
  notifyCourseStudents,
  notifyRole,
};
