const express = require('express');
const { getSnapshot, syncSnapshot } = require('../controllers/lms.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/snapshot', requireAuth, getSnapshot);
router.put('/snapshot', requireAuth, syncSnapshot);

module.exports = router;
