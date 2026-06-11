const Notification = require('../models/Notification');
const User = require('../models/User');
const { generateAcademicRemindersForUser } = require('../services/academicNotification.service');

const cleanupDuplicateWindowMs = 10 * 60 * 1000;

function getFilter(req) {
  const filter = { user: req.user._id };
  if (req.query.status === 'read') filter.isRead = true;
  if (req.query.status === 'unread') filter.isRead = false;
  return filter;
}

function getDuplicateKey(notification) {
  return [
    notification.notificationType,
    notification.relatedEntityType || '',
    String(notification.relatedEntityId ?? ''),
    notification.title,
    notification.message,
    notification.actionUrl || '',
  ].join('|');
}

async function cleanupRecentDuplicateNotifications(userId) {
  const recentNotifications = await Notification.find({
    user: userId,
    createdAt: { $gte: new Date(Date.now() - cleanupDuplicateWindowMs) },
  })
    .sort({ createdAt: -1 })
    .limit(200);

  const seen = new Set();
  const duplicates = [];

  recentNotifications.forEach((notification) => {
    const key = getDuplicateKey(notification);
    if (seen.has(key)) {
      duplicates.push(notification._id);
      return;
    }
    seen.add(key);
  });

  if (duplicates.length) {
    await Notification.deleteMany({ _id: { $in: duplicates }, user: userId });
  }
}

async function listNotifications(req, res, next) {
  try {
    await generateAcademicRemindersForUser(req.user);
    await cleanupRecentDuplicateNotifications(req.user._id);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const filter = getFilter(req);

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    return res.json({
      success: true,
      data: {
        items: items.map((notification) => notification.toClient()),
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    await generateAcademicRemindersForUser(req.user);
    await cleanupRecentDuplicateNotifications(req.user._id);

    const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    return next(error);
  }
}

async function getNotificationPreferences(req, res, next) {
  try {
    return res.json({
      success: true,
      data: {
        reminders: req.user.notificationPreferences?.reminders ?? true,
        announcements: req.user.notificationPreferences?.announcements ?? true,
        grades: req.user.notificationPreferences?.grades ?? true,
        courseMaterials: req.user.notificationPreferences?.courseMaterials ?? true,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateNotificationPreferences(req, res, next) {
  try {
    const allowedFields = ['reminders', 'announcements', 'grades', 'courseMaterials'];
    const nextPreferences = allowedFields.reduce((prefs, field) => {
      if (req.body[field] !== undefined) prefs[field] = Boolean(req.body[field]);
      return prefs;
    }, {});

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: Object.fromEntries(Object.entries(nextPreferences).map(([key, value]) => [`notificationPreferences.${key}`, value])) },
      { returnDocument: 'after' },
    );

    return res.json({
      success: true,
      data: {
        reminders: user.notificationPreferences?.reminders ?? true,
        announcements: user.notificationPreferences?.announcements ?? true,
        grades: user.notificationPreferences?.grades ?? true,
        courseMaterials: user.notificationPreferences?.courseMaterials ?? true,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { returnDocument: 'after' },
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.json({ success: true, data: notification.toClient() });
  } catch (error) {
    return next(error);
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    return next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  deleteNotification,
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
};
