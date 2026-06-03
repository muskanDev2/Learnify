const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getEnv } = require('../config/env');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'Login is required.',
      });
    }

    const { jwtSecret } = getEnv();
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user || user.active === false) {
      return res.status(401).json({
        success: false,
        message: 'Your session is no longer valid.',
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session.',
    });
  }
}

function requireAdmin(req, res, next) {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access is required.',
    });
  }

  return next();
}

function requireRoles(...allowedRoles) {
  const allowed = allowedRoles.map((role) => String(role).toLowerCase());

  return function roleGuard(req, res, next) {
    const userRole = String(req.user?.role || '').toLowerCase();

    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
    }

    return next();
  };
}

module.exports = { requireAdmin, requireAuth, requireRoles };
