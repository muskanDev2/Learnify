const mongoose = require('mongoose');

const LIVE_CLASS_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];

const liveClassSchema = new mongoose.Schema(
  {
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
    moduleId: {
      type: Number,
      default: null,
      index: true,
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    scheduledStartAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
      max: 480,
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    provider: {
      type: String,
      default: 'zoom',
      trim: true,
    },
    zoomMeetingId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    zoomMeetingUuid: {
      type: String,
      default: '',
      trim: true,
    },
    joinUrl: {
      type: String,
      required: true,
      trim: true,
    },
    startUrl: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: LIVE_CLASS_STATUSES,
      default: 'scheduled',
      index: true,
    },
    attendanceThresholdMinutes: {
      type: Number,
      default: 20,
      min: 1,
      max: 240,
    },
    attendanceSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

liveClassSchema.index({ courseId: 1, scheduledStartAt: -1 });

function computeTimeBasedStatus(doc, now = new Date()) {
  if (doc.status === 'cancelled') return 'cancelled';
  if (doc.status === 'completed') return 'completed';
  const start = new Date(doc.scheduledStartAt);
  const end = new Date(start.getTime() + Number(doc.durationMinutes || 60) * 60 * 1000);
  if (now < start) return 'scheduled';
  if (now >= start && now <= end) return 'live';
  return 'completed';
}

liveClassSchema.methods.toClient = function toClient(options = {}) {
  const includeHostLinks = Boolean(options.includeHostLinks);
  const effectiveStatus = computeTimeBasedStatus(this);

  return {
    id: this._id.toString(),
    courseId: this.courseId,
    moduleId: this.moduleId,
    title: this.title,
    description: this.description,
    scheduledStartAt: this.scheduledStartAt,
    durationMinutes: this.durationMinutes,
    timezone: this.timezone,
    provider: this.provider,
    zoomMeetingId: this.zoomMeetingId,
    joinUrl: this.joinUrl,
    startUrl: includeHostLinks ? this.startUrl : undefined,
    password: this.password || '',
    status: effectiveStatus,
    storedStatus: this.status,
    attendanceThresholdMinutes: this.attendanceThresholdMinutes,
    attendanceSyncedAt: this.attendanceSyncedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    instructor: this.instructor,
  };
};

module.exports = mongoose.model('LiveClass', liveClassSchema);
module.exports.LIVE_CLASS_STATUSES = LIVE_CLASS_STATUSES;
module.exports.computeTimeBasedStatus = computeTimeBasedStatus;
