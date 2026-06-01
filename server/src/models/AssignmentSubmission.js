const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema(
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
    assignmentItemId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    textSubmission: {
      type: String,
      default: '',
    },
    files: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['submitted', 'late', 'graded', 'resubmitted'],
      default: 'submitted',
    },
    grade: String,
    maxGrade: String,
    feedback: {
      type: String,
      default: '',
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    gradedAt: Date,
  },
  {
    timestamps: true,
  },
);

assignmentSubmissionSchema.index(
  { student: 1, course: 1, assignmentItemId: 1 },
  { unique: true },
);

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
