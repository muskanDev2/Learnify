const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ conversation: 1, createdAt: 1 });

messageSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    conversationId: this.conversation.toString(),
    senderId: this.sender?._id ? this.sender._id.toString() : String(this.sender),
    senderName: this.sender?.name || '',
    senderEmail: this.sender?.email || '',
    text: this.text,
    isRead: this.isRead,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Message', messageSchema);
