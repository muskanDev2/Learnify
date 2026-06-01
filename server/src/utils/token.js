const jwt = require('jsonwebtoken');
const { getEnv } = require('../config/env');

function signToken(user) {
  const { jwtSecret } = getEnv();

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required to create login tokens.');
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '7d' },
  );
}

module.exports = { signToken };
