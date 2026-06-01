const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['active', 'completed', 'dropped'],
      default: 'active',
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastActivityAt: Date,
  },
  {
    timestamps: true,
  },
);

enrollmentSchema.index({ studentEmail: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
