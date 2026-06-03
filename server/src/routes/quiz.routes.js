const express = require('express');
const { getMyQuizAttempts, listQuizAttempts, submitQuizAttempt } = require('../controllers/quiz.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:courseId/:quizItemId/attempts/submit', requireAuth, submitQuizAttempt);
router.get('/:courseId/:quizItemId/attempts/me', requireAuth, getMyQuizAttempts);
router.get('/:courseId/:quizItemId/attempts', requireAuth, listQuizAttempts);

module.exports = router;
