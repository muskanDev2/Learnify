const express = require('express');
const { getMyQuizAttempts, submitQuizAttempt } = require('../controllers/quiz.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:courseId/:quizItemId/attempts/submit', requireAuth, submitQuizAttempt);
router.get('/:courseId/:quizItemId/attempts/me', requireAuth, getMyQuizAttempts);

module.exports = router;
