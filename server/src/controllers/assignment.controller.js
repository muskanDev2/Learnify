const AssignmentSubmission = require('../models/AssignmentSubmission');
const Progress = require('../models/Progress');
const { sanitizeSubmissionFiles } = require('../utils/sanitizeCoursePayload');
const { recalculateCourseProgress, resolveCourseById } = require('../utils/lmsProgress');

function canManageCourse(user, course) {
  const role = String(user.role || '').toLowerCase();
  return role === 'admin' || String(course.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase();
}

async function submitAssignment(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const submittedAt = new Date();
    const isLate = req.body.dueAt && submittedAt > new Date(req.body.dueAt);

    const submission = await AssignmentSubmission.findOneAndUpdate(
      { student: req.user._id, course: course._id, assignmentItemId: req.params.assignmentItemId },
      {
        $setOnInsert: {
          student: req.user._id,
          course: course._id,
          courseId: course.id,
          assignmentItemId: req.params.assignmentItemId,
        },
        $set: {
          textSubmission: req.body.textSubmission || '',
          files: sanitizeSubmissionFiles(req.body.files),
          submittedAt,
          status: isLate ? 'late' : 'submitted',
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    await Progress.findOneAndUpdate(
      {
        $or: [
          { student: req.user._id, course: course._id, itemId: req.params.assignmentItemId },
          { studentEmail: req.user.email, courseId: course.id, itemId: req.params.assignmentItemId },
        ],
      },
      {
        $set: {
          student: req.user._id,
          course: course._id,
          studentEmail: req.user.email,
          courseId: course.id,
          itemId: req.params.assignmentItemId,
          itemType: 'assignment',
          completed: true,
          completedAt: submittedAt,
          lastActivityAt: submittedAt,
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    await recalculateCourseProgress(req.user, course);

    return res.status(201).json({
      success: true,
      message: 'Assignment submitted.',
      data: submission,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMySubmission(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const submission = await AssignmentSubmission.findOne({
      student: req.user._id,
      course: course._id,
      assignmentItemId: req.params.assignmentItemId,
    });

    return res.json({ success: true, data: submission });
  } catch (error) {
    return next(error);
  }
}

async function listSubmissions(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot view these submissions.' });
    }

    const submissions = await AssignmentSubmission.find({
      course: course._id,
      assignmentItemId: req.params.assignmentItemId,
    }).populate('student', 'name email');

    return res.json({ success: true, data: submissions });
  } catch (error) {
    return next(error);
  }
}

async function gradeSubmission(req, res, next) {
  try {
    const submission = await AssignmentSubmission.findById(req.params.id).populate('course');
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    if (!canManageCourse(req.user, submission.course)) {
      return res.status(403).json({ success: false, message: 'You cannot grade this submission.' });
    }

    submission.grade = req.body.grade || '';
    submission.maxGrade = req.body.maxGrade || '';
    submission.feedback = req.body.feedback || '';
    submission.status = 'graded';
    submission.gradedBy = req.user._id;
    submission.gradedAt = new Date();
    await submission.save();

    return res.json({ success: true, message: 'Submission graded.', data: submission });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMySubmission,
  gradeSubmission,
  listSubmissions,
  submitAssignment,
};
