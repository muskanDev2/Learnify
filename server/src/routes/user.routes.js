const express = require('express');
const {
  deleteUser,
  getMe,
  listUsers,
  updateMe,
  updateUser,
} = require('../controllers/user.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateMe);
router.get('/', requireAuth, requireAdmin, listUsers);
router.put('/:id', requireAuth, requireAdmin, updateUser);
router.delete('/:id', requireAuth, requireAdmin, deleteUser);

module.exports = router;
