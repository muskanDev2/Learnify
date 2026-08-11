const express = require('express');
const {
  cancelLiveClass,
  createLiveClass,
  getLiveClass,
  getLiveClassAttendance,
  listLiveClasses,
  syncLiveClassAttendance,
} = require('../controllers/liveClass.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listLiveClasses);
router.post('/', requireAuth, createLiveClass);
router.get('/:id/attendance', requireAuth, getLiveClassAttendance);
router.post('/:id/sync-attendance', requireAuth, syncLiveClassAttendance);
router.get('/:id', requireAuth, getLiveClass);
router.post('/:id/cancel', requireAuth, cancelLiveClass);

module.exports = router;
