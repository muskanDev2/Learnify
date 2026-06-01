const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    courseId: {
      type: Number,
      required: true,
      index: true,
    },
    quizItemId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    attemptNo: {
      type: Number,
      required: true,
      min: 1,
    },
    answers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    startedAt: Date,
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    autoSubmitted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['submitted', 'timed_out'],
      default: 'submitted',
    },
  },
  {
    timestamps: true,
  },
);

quizAttemptSchema.index({ student: 1, course: 1, quizItemId: 1, attemptNo: 1 }, { unique: true });
quizAttemptSchema.index({ student: 1, course: 1, quizItemId: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
