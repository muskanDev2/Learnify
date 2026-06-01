const express = require('express');
const { deleteNote, listMyNotes, saveNote } = require('../controllers/note.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:courseId', requireAuth, listMyNotes);
router.post('/:courseId', requireAuth, saveNote);
router.delete('/:id', requireAuth, deleteNote);

module.exports = router;
