const express = require('express');
const {
  deleteMe,
  deleteUser,
  getMe,
  listActiveStudents,
  listUsers,
  updateMe,
  updateUser,
} = require('../controllers/user.controller');
const { requireAdmin, requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateMe);
router.delete('/me', requireAuth, deleteMe);
router.get('/students', requireAuth, requireRoles('admin', 'instructor'), listActiveStudents);
router.get('/', requireAuth, requireAdmin, listUsers);
router.put('/:id', requireAuth, requireAdmin, updateUser);
router.delete('/:id', requireAuth, requireAdmin, deleteUser);

module.exports = router;
