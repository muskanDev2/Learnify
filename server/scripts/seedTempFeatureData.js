/**
 * Temporary feature-dev course for huzaifa@gmail.com + deepak@gmail.com enrollment.
 * Safe to delete later with removeTempFeatureData.js
 *
 * Usage: node scripts/seedTempFeatureData.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const mongoose = require('mongoose');
const { getEnv } = require('../src/config/env');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Enrollment = require('../src/models/Enrollment');

const INSTRUCTOR_EMAIL = 'huzaifa@gmail.com';
const STUDENT_EMAIL = 'deepak@gmail.com';
const TEMP_COURSE_TITLE = 'GYN Feature Test Course';

async function getNextCourseId() {
  const latest = await Course.findOne().sort({ id: -1 }).select('id');
  return latest?.id ? latest.id + 1 : 1;
}

async function main() {
  const { mongoUri } = getEnv();
  await mongoose.connect(mongoUri);

  const instructor = await User.findOne({ email: INSTRUCTOR_EMAIL });
  const student = await User.findOne({ email: STUDENT_EMAIL });

  if (!instructor || !student) {
    throw new Error('Temp users missing. Create huzaifa@gmail.com and deepak@gmail.com first.');
  }

  let course = await Course.findOne({ ownerEmail: INSTRUCTOR_EMAIL, title: TEMP_COURSE_TITLE });

  if (!course) {
    course = await Course.create({
      id: await getNextCourseId(),
      title: TEMP_COURSE_TITLE,
      subtitle: 'Temporary course for feature development',
      description: 'This course is for testing new features. It will be removed before production go-live.',
      instructor: instructor.name,
      category: 'Testing',
      enrollmentKey: 'GYN-TEST-2026',
      imageClass: 'courseImageBlue',
      lastAccessed: new Date().toISOString().slice(0, 10),
      ownerEmail: INSTRUCTOR_EMAIL,
      modules: [{ id: 1, title: 'General', items: [] }],
    });
  }

  let enrollment = await Enrollment.findOne({
    studentEmail: STUDENT_EMAIL,
    courseId: course.id,
    status: { $ne: 'dropped' },
  });

  if (!enrollment) {
    enrollment = await Enrollment.create({
      student: student._id,
      course: course._id,
      studentEmail: STUDENT_EMAIL,
      courseId: course.id,
      status: 'active',
      enrolledAt: new Date(),
    });
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        course: { id: course.id, title: course.title, ownerEmail: course.ownerEmail },
        enrollment: { studentEmail: enrollment.studentEmail, courseId: enrollment.courseId },
        enrollmentKey: course.enrollmentKey,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seed temp feature data failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
