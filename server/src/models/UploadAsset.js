const mongoose = require('mongoose');

const uploadAssetSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['cloudinary', 'local'],
      required: true,
    },
    resourceType: {
      type: String,
      default: 'raw',
      trim: true,
    },
    publicId: {
      type: String,
      default: '',
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

uploadAssetSchema.methods.toClient = function toClient() {
  return {
    id: String(this._id),
    name: this.originalName,
    originalFilename: this.originalName,
    mimeType: this.mimeType,
    size: this.size,
    url: this.url,
    secureUrl: this.url,
    provider: this.provider,
    resourceType: this.resourceType,
    publicId: this.publicId,
    uploadedAt: this.createdAt,
  };
};

module.exports = mongoose.model('UploadAsset', uploadAssetSchema);
