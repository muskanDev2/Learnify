const mongoose = require('mongoose');
const { sanitizeCourseModules } = require('../utils/sanitizeCoursePayload');

const courseSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    instructor: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    enrollmentKey: {
      type: String,
      default: '',
      trim: true,
    },
    imageClass: {
      type: String,
      default: 'courseImageBlue',
    },
    lastAccessed: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    ownerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    modules: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => [{ id: 1, title: 'General', items: [] }],
    },
  },
  {
    timestamps: true,
  },
);

courseSchema.methods.toClient = function toClient() {
  return {
    id: this.id,
    title: this.title,
    subtitle: this.subtitle,
    description: this.description,
    instructor: this.instructor,
    category: this.category,
    enrollmentKey: this.enrollmentKey,
    imageClass: this.imageClass,
    lastAccessed: this.lastAccessed,
    ownerEmail: this.ownerEmail,
    modules: sanitizeCourseModules(this.modules),
  };
};

module.exports = mongoose.model('Course', courseSchema);
