const express = require('express');
const {
  enrollInCourse,
  listEnrollments,
  manageEnrollment,
  unenrollStudent,
} = require('../controllers/enrollment.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listEnrollments);
router.post('/', requireAuth, enrollInCourse);
router.post('/manage', requireAuth, manageEnrollment);
router.delete('/:id', requireAuth, unenrollStudent);

module.exports = router;
