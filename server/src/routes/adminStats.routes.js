const express = require('express');
const { getProgressStats, getUserStats } = require('../controllers/adminStats.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/stats/users', requireAuth, requireAdmin, getUserStats);
router.get('/stats/progress', requireAuth, requireAdmin, getProgressStats);

module.exports = router;
