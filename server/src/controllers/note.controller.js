const StudentNote = require('../models/StudentNote');
const { resolveCourseById } = require('../utils/lmsProgress');

async function listMyNotes(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const notes = await StudentNote.find({ student: req.user._id, course: course._id }).sort({ updatedAt: -1 });
    return res.json({ success: true, data: notes });
  } catch (error) {
    return next(error);
  }
}

async function saveNote(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    const text = String(req.body.text || '').trim();

    if (!course || !text) {
      return res.status(400).json({ success: false, message: 'Course and note text are required.' });
    }

    const note = await StudentNote.create({
      student: req.user._id,
      course: course._id,
      courseId: course.id,
      itemId: req.body.itemId,
      text,
    });

    return res.status(201).json({ success: true, message: 'Note saved.', data: note });
  } catch (error) {
    return next(error);
  }
}

async function deleteNote(req, res, next) {
  try {
    await StudentNote.deleteOne({ _id: req.params.id, student: req.user._id });
    return res.json({ success: true, message: 'Note deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { deleteNote, listMyNotes, saveNote };
