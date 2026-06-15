const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
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
    studentName: {
      type: String,
      default: '',
    },
    courseTitle: {
      type: String,
      default: '',
    },
    instructorName: {
      type: String,
      default: '',
    },
    certificateApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    progressAtApproval: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    serialNumber: {
      type: String,
      default: '',
    },
    issueDate: Date,
    certificateUrl: {
      type: String,
      default: '',
    },
    provider: {
      type: String,
      enum: ['local', 'cloudinary'],
      default: 'local',
    },
  },
  {
    timestamps: true,
  },
);

certificateSchema.index({ student: 1, course: 1 }, { unique: true });

certificateSchema.methods.toClient = function toClient() {
  return {
    id: String(this._id),
    studentEmail: this.studentEmail,
    courseId: this.courseId,
    studentName: this.studentName,
    courseTitle: this.courseTitle,
    certificateApproved: this.certificateApproved,
    approvedAt: this.approvedAt || null,
    progressAtApproval: this.progressAtApproval,
    serialNumber: this.serialNumber,
    issueDate: this.issueDate || null,
    certificateUrl: this.certificateUrl,
  };
};

module.exports = mongoose.model('Certificate', certificateSchema);
