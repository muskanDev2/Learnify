const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');
const { recalculateCourseProgress, resolveCourseById } = require('../utils/lmsProgress');

function canManageCourse(user, course) {
  const role = String(user.role || '').toLowerCase();
  return role === 'admin' || String(course.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase();
}

function findQuiz(course, quizItemId) {
  const id = String(quizItemId);
  return (course.modules || [])
    .flatMap((module) => module.items || [])
    .find((item) => String(item.id) === id && item.type === 'quiz');
}

function calculateQuizScore(quiz, answers) {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  let score = 0;
  const normalizedAnswers = answers && typeof answers === 'object' ? answers : {};

  questions.forEach((question) => {
    const points = Number(question.points) > 0 ? Number(question.points) : 1;
    if (Number(normalizedAnswers[question.id]) === Number(question.answer)) {
      score += points;
    }
  });

  const totalMarks = questions.reduce(
    (sum, question) => sum + (Number(question.points) > 0 ? Number(question.points) : 1),
    0,
  );

  return {
    score,
    totalMarks,
    percentage: totalMarks ? Math.round((score / totalMarks) * 100) : 0,
  };
}

async function submitQuizAttempt(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const quiz = findQuiz(course, req.params.quizItemId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    const attemptCount = await QuizAttempt.countDocuments({
      student: req.user._id,
      course: course._id,
      quizItemId: req.params.quizItemId,
    });
    const maxAttempts = Number(quiz.maxAttempts) > 0 ? Number(quiz.maxAttempts) : 1;

    if (attemptCount >= maxAttempts) {
      return res.status(400).json({ success: false, message: 'No quiz attempts remaining.' });
    }

    const { score, totalMarks, percentage } = calculateQuizScore(quiz, req.body.answers);
    const autoSubmitted = Boolean(req.body.autoSubmitted);
    const attempt = await QuizAttempt.create({
      student: req.user._id,
      course: course._id,
      courseId: course.id,
      quizItemId: req.params.quizItemId,
      attemptNo: attemptCount + 1,
      answers: Object.entries(req.body.answers || {}).map(([questionId, selectedAnswer]) => ({
        questionId,
        selectedAnswer,
      })),
      score,
      totalMarks,
      percentage,
      startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
      submittedAt: new Date(),
      durationSeconds: Math.max(0, Number(req.body.durationSeconds) || 0),
      autoSubmitted,
      status: autoSubmitted ? 'timed_out' : 'submitted',
    });

    await Progress.findOneAndUpdate(
      {
        $or: [
          { student: req.user._id, course: course._id, itemId: req.params.quizItemId },
          { studentEmail: req.user.email, courseId: course.id, itemId: req.params.quizItemId },
        ],
      },
      {
        $set: {
          student: req.user._id,
          course: course._id,
          studentEmail: req.user.email,
          courseId: course.id,
          itemId: req.params.quizItemId,
          itemType: 'quiz',
          completed: true,
          completedAt: new Date(),
          lastActivityAt: new Date(),
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    await recalculateCourseProgress(req.user, course);

    return res.status(201).json({
      success: true,
      message: 'Quiz attempt submitted.',
      data: attempt,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyQuizAttempts(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const attempts = await QuizAttempt.find({
      student: req.user._id,
      course: course._id,
      quizItemId: req.params.quizItemId,
    }).sort({ attemptNo: 1 });

    return res.json({ success: true, data: attempts });
  } catch (error) {
    return next(error);
  }
}

async function listQuizAttempts(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot view these quiz attempts.' });
    }

    const attempts = await QuizAttempt.find({
      course: course._id,
      quizItemId: req.params.quizItemId,
    })
      .populate('student', 'name email')
      .sort({ submittedAt: -1, attemptNo: -1 });

    return res.json({ success: true, data: attempts });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMyQuizAttempts, listQuizAttempts, submitQuizAttempt };
