const mongoose = require('mongoose');

const liveClassAttendanceSchema = new mongoose.Schema(
  {
    liveClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveClass',
      required: true,
      index: true,
    },
    courseId: {
      type: Number,
      required: true,
      index: true,
    },
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
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'unknown'],
      default: 'absent',
    },
    joinTime: {
      type: Date,
      default: null,
    },
    leaveTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    zoomParticipantId: {
      type: String,
      default: '',
    },
    syncedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  },
);

liveClassAttendanceSchema.index({ liveClass: 1, student: 1 }, { unique: true });

liveClassAttendanceSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    liveClassId: this.liveClass?.toString() || String(this.liveClass),
    courseId: this.courseId,
    student: this.student,
    studentEmail: this.studentEmail,
    status: this.status,
    joinTime: this.joinTime,
    leaveTime: this.leaveTime,
    durationMinutes: this.durationMinutes,
    syncedAt: this.syncedAt,
  };
};

module.exports = mongoose.model('LiveClassAttendance', liveClassAttendanceSchema);
