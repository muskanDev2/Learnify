const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
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
    message: {
      type: String,
      required: true,
      trim: true,
    },
    notificationType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    courseId: {
      type: Number,
      index: true,
    },
    relatedEntityType: {
      type: String,
      default: '',
      trim: true,
    },
    dedupeKey: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    actionUrl: {
      type: String,
      default: '',
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $gt: '' } } });

notificationSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    userId: this.user.toString(),
    title: this.title,
    message: this.message,
    notificationType: this.notificationType,
    relatedEntityId: this.relatedEntityId,
    courseId: this.courseId,
    relatedEntityType: this.relatedEntityType,
    dedupeKey: this.dedupeKey,
    actionUrl: this.actionUrl,
    isRead: this.isRead,
    readAt: this.readAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Notification', notificationSchema);
