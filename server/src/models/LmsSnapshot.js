const mongoose = require('mongoose');

const lmsSnapshotSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'main',
      unique: true,
    },
    courses: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    enrollments: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    studentProgress: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LmsSnapshot', lmsSnapshotSchema);
