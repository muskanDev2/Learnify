const UploadAsset = require('../models/UploadAsset');
const { getEnv } = require('../config/env');
const { deleteTempFile, storeUploadedFile } = require('../services/upload.service');
const { createCloudinarySignature, hasCloudinaryConfig } = require('../services/upload.service');

function getClientResourceType(mimeType) {
  if (String(mimeType || '').startsWith('image/')) return 'image';
  if (String(mimeType || '').startsWith('video/')) return 'video';
  return 'raw';
}

function requireConfiguredCloudinary(res) {
  const { cloudinary } = getEnv();
  if (hasCloudinaryConfig(cloudinary)) return cloudinary;

  res.status(503).json({
    success: false,
    message: 'Cloudinary is not configured. Add Cloudinary environment variables on Render.',
  });
  return null;
}

async function uploadFiles(req, res, next) {
  const files = Array.isArray(req.files) ? req.files : [];

  try {
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'Please choose at least one file to upload.',
      });
    }

    const uploadedAssets = [];

    for (const file of files) {
      const storedFile = await storeUploadedFile(file, req);
      const asset = await UploadAsset.create({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        owner: req.user._id,
        ...storedFile,
      });
      uploadedAssets.push(asset.toClient());
    }

    return res.status(201).json({
      success: true,
      message: 'Files uploaded successfully.',
      data: uploadedAssets,
    });
  } catch (error) {
    await Promise.all(files.map((file) => deleteTempFile(file.path)));
    return next(error);
  }
}

async function getCloudinarySignature(req, res, next) {
  try {
    const cloudinaryConfig = requireConfiguredCloudinary(res);
    if (!cloudinaryConfig) return null;

    const timestamp = Math.round(Date.now() / 1000);
    const folder = cloudinaryConfig.folder;

    return res.json({
      success: true,
      data: {
        cloudName: cloudinaryConfig.cloudName,
        apiKey: cloudinaryConfig.apiKey,
        folder,
        timestamp,
        uploadPreset: cloudinaryConfig.uploadPreset,
        signature: createCloudinarySignature({
          folder,
          timestamp,
          ...(cloudinaryConfig.uploadPreset ? { upload_preset: cloudinaryConfig.uploadPreset } : {}),
        }),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function createCloudinaryAsset(req, res, next) {
  try {
    requireConfiguredCloudinary(res);
    if (res.headersSent) return null;

    const { name, mimeType, size, url, publicId, resourceType } = req.body;

    if (!name || !mimeType || !url || !publicId) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file metadata is incomplete.',
      });
    }

    const asset = await UploadAsset.create({
      originalName: name,
      mimeType,
      size: Number(size) || 0,
      url,
      publicId,
      resourceType: resourceType || getClientResourceType(mimeType),
      provider: 'cloudinary',
      owner: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Upload metadata saved.',
      data: asset.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createCloudinaryAsset, getCloudinarySignature, uploadFiles };
