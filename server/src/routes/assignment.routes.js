const express = require('express');
const {
  getMySubmission,
  gradeSubmission,
  listSubmissions,
  submitAssignment,
} = require('../controllers/assignment.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:courseId/:assignmentItemId/submissions', requireAuth, submitAssignment);
router.get('/:courseId/:assignmentItemId/submissions/me', requireAuth, getMySubmission);
router.get('/:courseId/:assignmentItemId/submissions', requireAuth, listSubmissions);
router.put('/submissions/:id/grade', requireAuth, gradeSubmission);

module.exports = router;
