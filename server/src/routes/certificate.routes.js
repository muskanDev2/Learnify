const express = require('express');
const {
  approveCertificate,
  listInstructorOverview,
  listMyCertificates,
} = require('../controllers/certificate.controller');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, listMyCertificates);
router.get('/instructor/overview', requireAuth, requireRoles('admin', 'instructor'), listInstructorOverview);
router.post('/approve', requireAuth, requireRoles('admin', 'instructor'), approveCertificate);

module.exports = router;
