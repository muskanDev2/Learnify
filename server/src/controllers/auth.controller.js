const User = require('../models/User');
const { notifyAdmins } = require('../services/notification.service');
const { signToken } = require('../utils/token');

const validRoles = ['admin', 'instructor', 'student'];

function normalizeRole(role) {
  const normalized = String(role || '').toLowerCase().trim();
  return validRoles.includes(normalized) ? normalized : 'student';
}

function authResponse(user, message) {
  return {
    success: true,
    message,
    user: user.toClient(),
    token: signToken(user),
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: normalizeRole(role),
      active: true,
    });

    notifyAdmins({
      title: user.role === 'instructor' ? 'New instructor registered' : 'New user registered',
      message: `${user.name} registered as ${user.role}.`,
      notificationType: user.role === 'instructor' ? 'instructor_registration' : 'user_registration',
      relatedEntityId: user._id,
      relatedEntityType: 'user',
      actionUrl: '/dashboard?tab=users',
    }).catch(() => {});

    return res.status(201).json(authResponse(user, 'Registration successful!'));
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (user.active === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Contact admin.',
      });
    }

    return res.json(authResponse(user, 'Login successful!'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login };
