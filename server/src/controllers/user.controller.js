const User = require('../models/User');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const QuizAttempt = require('../models/QuizAttempt');
const StudentNote = require('../models/StudentNote');
const UploadAsset = require('../models/UploadAsset');

const allowedProfileFields = [
  'name',
  'phone',
  'address',
  'country',
  'gender',
  'semester',
  'degreeProgram',
  'profileImage',
  'countryLocked',
  'genderLocked',
];
const allowedAdminFields = [
  'name',
  'email',
  'role',
  'active',
  'phone',
  'address',
  'country',
  'gender',
  'semester',
  'degreeProgram',
  'profileImage',
];
const roles = ['admin', 'instructor', 'student'];

function normalizeRole(role) {
  const value = String(role || '').toLowerCase().trim();
  return roles.includes(value) ? value : 'student';
}

function normalizeSemester(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const semester = Number(value);
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    const error = new Error('Semester must be a whole number between 1 and 12.');
    error.statusCode = 400;
    throw error;
  }
  return semester;
}

function normalizeDegreeProgram(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const degreeProgram = String(value).trim();
  if (degreeProgram.length < 2 || degreeProgram.length > 120) {
    const error = new Error('Degree program must be between 2 and 120 characters.');
    error.statusCode = 400;
    throw error;
  }
  return degreeProgram;
}

function applyAllowedUserFields(user, body, allowedFields) {
  allowedFields.forEach((field) => {
    if (body[field] === undefined) return;

    if (field === 'role') {
      user[field] = normalizeRole(body[field]);
      return;
    }

    if (field === 'semester') {
      user[field] = normalizeSemester(body[field]);
      return;
    }

    if (field === 'degreeProgram') {
      user[field] = normalizeDegreeProgram(body[field]);
      return;
    }

    user[field] = body[field];
  });
}

async function getMe(req, res) {
  return res.json({
    success: true,
    data: req.user.toClient(),
  });
}

async function updateMe(req, res, next) {
  try {
    applyAllowedUserFields(req.user, req.body, allowedProfileFields);

    await req.user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: req.user.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: users.map((user) => user.toClient()),
    });
  } catch (error) {
    return next(error);
  }
}

async function listActiveStudents(req, res, next) {
  try {
    const students = await User.find({ role: 'student', active: { $ne: false } }).sort({
      name: 1,
      email: 1,
    });

    return res.json({
      success: true,
      data: students.map((student) => student.toClient()),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const currentAdminId = req.user._id.toString();
    const targetId = user._id.toString();
    const targetIsAdmin = user.role === 'admin';

    if (targetIsAdmin && targetId !== currentAdminId) {
      return res.status(403).json({
        success: false,
        message: 'You cannot update another admin account.',
      });
    }

    applyAllowedUserFields(user, req.body, allowedAdminFields);

    if (targetId === currentAdminId && user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot demote your own admin account.',
      });
    }

    if (targetIsAdmin && user.active === false) {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be deactivated.',
      });
    }

    await user.save();

    return res.json({
      success: true,
      message: 'User updated successfully.',
      data: user.toClient(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Another user already uses this email.' });
    }
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be deleted.',
      });
    }

    await user.deleteOne();

    return res.json({
      success: true,
      message: 'User deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteMe(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const userEmail = String(req.user.email || '').toLowerCase();
    const userRole = String(req.user.role || '').toLowerCase();
    const ownedCourses = userRole === 'instructor'
      ? await Course.find({ ownerEmail: userEmail }).select('_id id title')
      : [];
    const ownedCourseObjectIds = ownedCourses.map((course) => course._id);
    const ownedCourseIds = ownedCourses.map((course) => course.id);
    const shouldDeleteOwnedCourses = req.body?.deleteOwnedCourses === true;

    if (ownedCourses.length > 0 && !shouldDeleteOwnedCourses) {
      return res.status(409).json({
        success: false,
        code: 'OWNED_COURSES_CONFIRMATION_REQUIRED',
        message: 'Deleting this instructor account also requires deleting all owned courses.',
        data: {
          ownedCourseCount: ownedCourses.length,
          ownedCourses: ownedCourses.map((course) => ({
            id: course.id,
            title: course.title,
          })),
        },
      });
    }

    await Promise.all([
      Enrollment.deleteMany({ $or: [{ student: req.user._id }, { studentEmail: userEmail }] }),
      Progress.deleteMany({ $or: [{ student: req.user._id }, { studentEmail: userEmail }] }),
      CourseProgress.deleteMany({ student: req.user._id }),
      QuizAttempt.deleteMany({ student: req.user._id }),
      AssignmentSubmission.deleteMany({ student: req.user._id }),
      StudentNote.deleteMany({ student: req.user._id }),
      UploadAsset.deleteMany({ owner: req.user._id }),
      AssignmentSubmission.updateMany({ gradedBy: req.user._id }, { $unset: { gradedBy: '', gradedAt: '' } }),
    ]);

    if (ownedCourses.length > 0) {
      await Promise.all([
        Course.deleteMany({ _id: { $in: ownedCourseObjectIds } }),
        Enrollment.deleteMany({ $or: [{ course: { $in: ownedCourseObjectIds } }, { courseId: { $in: ownedCourseIds } }] }),
        Progress.deleteMany({ $or: [{ course: { $in: ownedCourseObjectIds } }, { courseId: { $in: ownedCourseIds } }] }),
        CourseProgress.deleteMany({ $or: [{ course: { $in: ownedCourseObjectIds } }, { courseId: { $in: ownedCourseIds } }] }),
        QuizAttempt.deleteMany({ $or: [{ course: { $in: ownedCourseObjectIds } }, { courseId: { $in: ownedCourseIds } }] }),
        AssignmentSubmission.deleteMany({ $or: [{ course: { $in: ownedCourseObjectIds } }, { courseId: { $in: ownedCourseIds } }] }),
        StudentNote.deleteMany({ $or: [{ course: { $in: ownedCourseObjectIds } }, { courseId: { $in: ownedCourseIds } }] }),
      ]);
    }

    await req.user.deleteOne();

    return res.json({
      success: true,
      message: 'Account and personal data deleted successfully.',
      data: {
        id: userId,
        deletedOwnedCourseCount: ownedCourses.length,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  deleteMe,
  deleteUser,
  getMe,
  listActiveStudents,
  listUsers,
  updateMe,
  updateUser,
};
