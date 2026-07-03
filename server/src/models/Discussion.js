const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema(
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
    author: {
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
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

discussionSchema.methods.toClient = function toClient() {
  const authorData = this.author && typeof this.author.toClient === 'function'
    ? this.author.toClient()
    : this.author;

  return {
    id: this._id.toString(),
    course: this.course?.toString() || this.course,
    courseId: this.courseId,
    title: this.title,
    description: this.description,
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

module.exports = mongoose.model('Discussion', discussionSchema);
