const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const LmsSnapshot = require('../models/LmsSnapshot');
const User = require('../models/User');
const { createNotification } = require('../services/notification.service');

async function getActiveStudentEmails() {
  const students = await User.find({ role: 'student', active: { $ne: false } }).select('email');
  return new Set(students.map((student) => String(student.email || '').toLowerCase()));
}

function toEnrollmentMap(enrollments, activeStudentEmails = null) {
  return enrollments.reduce((map, enrollment) => {
    if (enrollment.status === 'dropped') return map;

    const email = String(enrollment.studentEmail || '').toLowerCase();
    if (!email || (activeStudentEmails && !activeStudentEmails.has(email))) return map;

    if (!map[email]) map[email] = [];
    if (!map[email].includes(enrollment.courseId)) {
      map[email].push(enrollment.courseId);
    }

    return map;
  }, {});
}

async function migrateSnapshotEnrollmentsIfEmpty() {
  const count = await Enrollment.countDocuments();
  if (count > 0) return;

  const snapshot = await LmsSnapshot.findOne({ key: 'main' });
  const snapshotEnrollments =
    snapshot?.enrollments && typeof snapshot.enrollments === 'object' ? snapshot.enrollments : {};

  const docs = Object.entries(snapshotEnrollments).flatMap(([studentEmail, courseIds]) =>
    Array.isArray(courseIds)
      ? courseIds.map((courseId) => ({
          studentEmail: String(studentEmail).toLowerCase(),
          courseId: Number(courseId),
        }))
      : [],
  );

  if (docs.length) {
    await Enrollment.insertMany(docs, { ordered: false }).catch(() => {});
  }
}

async function listEnrollments(req, res, next) {
  try {
    await migrateSnapshotEnrollmentsIfEmpty();

    const activeStudentEmails = await getActiveStudentEmails();
    const enrollments = await Enrollment.find({ status: { $ne: 'dropped' } }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: toEnrollmentMap(enrollments, activeStudentEmails),
    });
  } catch (error) {
    return next(error);
  }
}

function canManageEnrollment(user, course) {
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;
  return role === 'instructor' && String(course.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase();
}

async function enrollInCourse(req, res, next) {
  try {
    const studentEmail = String(req.user.email || '').toLowerCase();
    const courseId = Number(req.body.courseId);
    const enteredKey = String(req.body.enrollmentKey || '').trim();

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course id is required.',
      });
    }

    const course = await Course.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    const requiredKey = String(course.enrollmentKey || '').trim();
    if (requiredKey && enteredKey !== requiredKey) {
      return res.status(403).json({
        success: false,
        message: 'Invalid key. Please contact the instructor.',
      });
    }

    await Enrollment.findOneAndUpdate(
      {
        $or: [
          { student: req.user._id, course: course._id },
          { studentEmail, courseId },
        ],
      },
      {
        $set: {
          student: req.user._id,
          course: course._id,
          studentEmail,
          courseId,
          status: 'active',
          lastActivityAt: new Date(),
        },
        $setOnInsert: {
          enrolledAt: new Date(),
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    const instructor = await User.findOne({ email: String(course.ownerEmail || '').toLowerCase() }).select('_id');
    createNotification(req.user._id, {
      title: 'Course enrollment confirmed',
      message: `You are now enrolled in ${course.title}.`,
      notificationType: 'course_enrollment',
      relatedEntityId: course.id,
      relatedEntityType: 'course',
      actionUrl: `/courses?courseId=${course.id}`,
    }).catch(() => {});
    if (instructor) {
      createNotification(instructor._id, {
        title: 'Student enrolled in course',
        message: `${req.user.name} enrolled in ${course.title}.`,
        notificationType: 'student_enrolled',
        relatedEntityId: course.id,
        relatedEntityType: 'course',
        actionUrl: `/courses?courseId=${course.id}`,
      }).catch(() => {});
    }

    const activeStudentEmails = await getActiveStudentEmails();
    const enrollments = await Enrollment.find({ status: { $ne: 'dropped' } });

    return res.status(201).json({
      success: true,
      message: 'Enrollment successful.',
      data: toEnrollmentMap(enrollments, activeStudentEmails),
    });
  } catch (error) {
    return next(error);
  }
}

async function manageEnrollment(req, res, next) {
  try {
    const courseId = Number(req.body.courseId);
    const studentId = req.body.studentId;
    const studentEmail = String(req.body.studentEmail || '').toLowerCase().trim();
    const status = ['active', 'completed', 'dropped'].includes(req.body.status)
      ? req.body.status
      : 'active';

    const course = await Course.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!canManageEnrollment(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot manage this course enrollment.' });
    }

    const student = studentId
      ? await User.findById(studentId)
      : await User.findOne({ email: studentEmail });

    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    await Enrollment.findOneAndUpdate(
      {
        $or: [
          { student: student._id, course: course._id },
          { studentEmail: student.email, courseId: course.id },
        ],
      },
      {
        $set: {
          student: student._id,
          course: course._id,
          studentEmail: student.email,
          courseId: course.id,
          status,
          lastActivityAt: new Date(),
          ...(status === 'completed' ? { completedAt: new Date() } : {}),
        },
        $setOnInsert: {
          enrolledAt: new Date(),
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    if (status === 'active') {
      createNotification(student._id, {
        title: 'New course enrollment',
        message: `You have been enrolled in ${course.title}.`,
        notificationType: 'course_enrollment',
        relatedEntityId: course.id,
        relatedEntityType: 'course',
        actionUrl: `/courses?courseId=${course.id}`,
      }).catch(() => {});
    }

    const activeStudentEmails = await getActiveStudentEmails();
    const enrollments = await Enrollment.find({ status: { $ne: 'dropped' } });
    return res.json({
      success: true,
      message: 'Enrollment updated successfully.',
      data: toEnrollmentMap(enrollments, activeStudentEmails),
    });
  } catch (error) {
    return next(error);
  }
}

async function unenrollStudent(req, res, next) {
  try {
    const enrollment = await Enrollment.findById(req.params.id).populate('course');
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found.' });
    }

    if (!canManageEnrollment(req.user, enrollment.course)) {
      return res.status(403).json({ success: false, message: 'You cannot manage this enrollment.' });
    }

    enrollment.status = 'dropped';
    enrollment.lastActivityAt = new Date();
    await enrollment.save();

    const activeStudentEmails = await getActiveStudentEmails();
    const enrollments = await Enrollment.find({ status: { $ne: 'dropped' } });
    return res.json({
      success: true,
      message: 'Student unenrolled successfully.',
      data: toEnrollmentMap(enrollments, activeStudentEmails),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { enrollInCourse, listEnrollments, manageEnrollment, unenrollStudent };
