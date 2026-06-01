const express = require('express');
const {
  createCourse,
  deleteCourse,
  listCourses,
  updateStudentCourseWork,
  updateCourse,
} = require('../controllers/course.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listCourses);
router.post('/', requireAuth, createCourse);
router.put('/:id', requireAuth, updateCourse);
router.put('/:id/student-work', requireAuth, updateStudentCourseWork);
router.delete('/:id', requireAuth, deleteCourse);

module.exports = router;
