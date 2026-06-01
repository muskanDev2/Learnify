const express = require('express');
const {
  getMyCourseProgress,
  listMyProgress,
  listProgress,
  openContent,
  saveContentTime,
  saveItemProgress,
} = require('../controllers/progress.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listProgress);
router.put('/', requireAuth, saveItemProgress);
router.post('/content/open', requireAuth, openContent);
router.put('/content/time', requireAuth, saveContentTime);
router.put('/item/complete', requireAuth, saveItemProgress);
router.get('/me', requireAuth, listMyProgress);
router.get('/me/:courseId', requireAuth, getMyCourseProgress);

module.exports = router;
