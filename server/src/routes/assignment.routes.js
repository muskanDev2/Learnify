const express = require('express');
const {
  createAssignment,
  deleteSubmission,
  getMySubmission,
  gradeSubmission,
  listCourseAssignments,
  listSubmissions,
  submitAssignment,
} = require('../controllers/assignment.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:courseId', requireAuth, listCourseAssignments);
router.post('/:courseId', requireAuth, createAssignment);
router.post('/:courseId/:assignmentItemId/submissions', requireAuth, submitAssignment);
router.get('/:courseId/:assignmentItemId/submissions/me', requireAuth, getMySubmission);
router.get('/:courseId/:assignmentItemId/submissions', requireAuth, listSubmissions);
router.put('/submissions/:id/grade', requireAuth, gradeSubmission);
router.delete('/submissions/:id', requireAuth, deleteSubmission);

module.exports = router;
