const express = require('express');
const { createSupportRequest, listMySupportRequests } = require('../controllers/support.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/requests', requireAuth, createSupportRequest);
router.get('/requests/me', requireAuth, listMySupportRequests);

module.exports = router;
