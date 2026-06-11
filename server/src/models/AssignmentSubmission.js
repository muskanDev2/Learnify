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
    fileUrl: String,
    cloudinaryPublicId: String,
    fileType: String,
    originalFilename: String,
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

assignmentSubmissionSchema.methods.toClient = function toClient() {
  return {
    _id: String(this._id),
    id: String(this._id),
    student: this.student,
    course: this.course,
    courseId: this.courseId,
    assignmentItemId: this.assignmentItemId,
    textSubmission: this.textSubmission,
    files: this.files,
    fileUrl: this.fileUrl,
    cloudinaryPublicId: this.cloudinaryPublicId,
    fileType: this.fileType,
    originalFilename: this.originalFilename,
    submittedAt: this.submittedAt,
    status: this.status,
    grade: this.grade,
    maxGrade: this.maxGrade,
    feedback: this.feedback,
    gradedBy: this.gradedBy,
    gradedAt: this.gradedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
