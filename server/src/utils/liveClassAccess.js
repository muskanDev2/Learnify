const Enrollment = require('../models/Enrollment');

async function canAccessCourseLiveClasses(user, course) {
  if (!user || !course) return false;

  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;

  if (role === 'instructor') {
    return String(course.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase();
  }

  if (role === 'student') {
    const studentEmail = String(user.email || '').toLowerCase();
    const enrollment = await Enrollment.findOne({
      $or: [
        { student: user._id, course: course._id },
        { studentEmail, courseId: course.id },
      ],
      status: { $ne: 'dropped' },
    });
    return !!enrollment;
  }

  return false;
}

function canManageCourseLiveClasses(user, course) {
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (role === 'instructor') {
    return String(course.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase();
  }
  return false;
}

module.exports = {
  canAccessCourseLiveClasses,
  canManageCourseLiveClasses,
};
