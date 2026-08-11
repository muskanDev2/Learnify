const express = require('express');
const { getAdminReports, getProgressStats, getUserStats } = require('../controllers/adminStats.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/stats/users', requireAuth, requireAdmin, getUserStats);
router.get('/stats/progress', requireAuth, requireAdmin, getProgressStats);
router.get('/reports', requireAuth, requireAdmin, getAdminReports);

module.exports = router;
