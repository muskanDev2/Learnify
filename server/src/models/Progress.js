const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      index: true,
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
    },
    studentEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    courseId: {
      type: Number,
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['content', 'quiz', 'assignment'],
      default: 'content',
    },
    completed: {
      type: Boolean,
      default: true,
    },
    openedAt: Date,
    completedAt: Date,
    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActivityAt: Date,
  },
  {
    timestamps: true,
  },
);

progressSchema.index({ studentEmail: 1, courseId: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
