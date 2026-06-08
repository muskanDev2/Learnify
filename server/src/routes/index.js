const express = require('express');
const adminStatsRoutes = require('./adminStats.routes');
const assignmentRoutes = require('./assignment.routes');
const authRoutes = require('./auth.routes');
const courseRoutes = require('./course.routes');
const enrollmentRoutes = require('./enrollment.routes');
const healthRoutes = require('./health.routes');
const lmsRoutes = require('./lms.routes');
const noteRoutes = require('./note.routes');
const progressRoutes = require('./progress.routes');
const quizRoutes = require('./quiz.routes');
const uploadRoutes = require('./upload.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Learnify backend',
    docs: 'Use /api/health to check server and database status',
  });
});

router.use('/health', healthRoutes);
router.use('/admin', adminStatsRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/lms', lmsRoutes);
router.use('/notes', noteRoutes);
router.use('/progress', progressRoutes);
router.use('/quizzes', quizRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);

module.exports = router;
