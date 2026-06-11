const express = require('express');
const {
  deleteNotification,
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listNotifications);
router.get('/unread-count', requireAuth, getUnreadCount);
router.get('/preferences', requireAuth, getNotificationPreferences);
router.put('/preferences', requireAuth, updateNotificationPreferences);
router.put('/mark-all-read', requireAuth, markAllNotificationsRead);
router.put('/:id/read', requireAuth, markNotificationRead);
router.delete('/:id', requireAuth, deleteNotification);

module.exports = router;
