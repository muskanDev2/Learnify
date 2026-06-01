const mongoose = require('mongoose');

const courseProgressSchema = new mongoose.Schema(
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
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    completedItems: {
      type: Number,
      default: 0,
    },
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    quizAverage: {
      type: Number,
      default: 0,
    },
    assignmentSubmittedCount: {
      type: Number,
      default: 0,
    },
    assignmentTotalCount: {
      type: Number,
      default: 0,
    },
    lastActivityAt: Date,
  },
  {
    timestamps: true,
  },
);

courseProgressSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('CourseProgress', courseProgressSchema);
