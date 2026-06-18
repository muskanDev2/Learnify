const mongoose = require('mongoose');

const supportRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    userName: {
      type: String,
      default: '',
    },
    userRole: {
      type: String,
      default: 'student',
    },
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['account', 'courses', 'assignments', 'certificates', 'technical', 'other'],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    resolvedAt: Date,
  },
  {
    timestamps: true,
  },
);

supportRequestSchema.methods.toClient = function toClient() {
  return {
    id: String(this._id),
    ticketId: this.ticketId,
    category: this.category,
    subject: this.subject,
    message: this.message,
    status: this.status,
    createdAt: this.createdAt,
    resolvedAt: this.resolvedAt || null,
  };
};

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
