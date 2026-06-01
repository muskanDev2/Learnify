const User = require('../models/User');

const allowedProfileFields = [
  'name',
  'phone',
  'address',
  'country',
  'gender',
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
  'profileImage',
];
const roles = ['admin', 'instructor', 'student'];

function normalizeRole(role) {
  const value = String(role || '').toLowerCase().trim();
  return roles.includes(value) ? value : 'student';
}

async function getMe(req, res) {
  return res.json({
    success: true,
    data: req.user.toClient(),
  });
}

async function updateMe(req, res, next) {
  try {
    allowedProfileFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        req.user[field] = req.body[field];
      }
    });

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

    allowedAdminFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = field === 'role' ? normalizeRole(req.body[field]) : req.body[field];
      }
    });

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

module.exports = {
  deleteUser,
  getMe,
  listUsers,
  updateMe,
  updateUser,
};
