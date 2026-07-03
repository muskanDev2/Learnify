const mongoose = require('mongoose');

const discussionReplySchema = new mongoose.Schema(
  {
    discussion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

discussionReplySchema.methods.toClient = function toClient() {
  const authorData = this.author && typeof this.author.toClient === 'function'
    ? this.author.toClient()
    : this.author;

  return {
    id: this._id.toString(),
    discussion: this.discussion?.toString() || this.discussion,
    message: this.message,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    author: authorData ? {
      id: authorData.id || authorData._id?.toString() || String(authorData),
      name: authorData.name || '',
      email: authorData.email || '',
      role: authorData.role || '',
      profileImage: authorData.profileImage || '',
    } : null,
  };
};

module.exports = mongoose.model('DiscussionReply', discussionReplySchema);
