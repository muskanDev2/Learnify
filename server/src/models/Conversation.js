const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: 'A conversation must have exactly two participants.',
      },
      required: true,
    },
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.statics.buildParticipantKey = function buildParticipantKey(userIdA, userIdB) {
  const ids = [String(userIdA), String(userIdB)].sort();
  return `${ids[0]}:${ids[1]}`;
};

conversationSchema.methods.toClient = function toClient(extra = {}) {
  return {
    id: this._id.toString(),
    participants: (this.participants || []).map((participant) =>
      participant?._id ? participant._id.toString() : String(participant),
    ),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

module.exports = mongoose.model('Conversation', conversationSchema);
