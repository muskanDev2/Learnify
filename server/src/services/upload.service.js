const fs = require('fs/promises');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { getEnv } = require('../config/env');

const localUploadDir = path.join(process.cwd(), 'uploads');

function hasCloudinaryConfig(config) {
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

function createCloudinarySignature(params) {
  const { cloudinary: cloudinaryConfig } = getEnv();

  return cloudinary.utils.api_sign_request(params, cloudinaryConfig.apiSecret);
}

function getCloudinaryResourceType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}

function shouldUseChunkedUpload(file) {
  return file.mimetype.startsWith('video/') || file.size > 50 * 1024 * 1024;
}

async function deleteTempFile(filePath) {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => {});
}

async function uploadToCloudinary(file) {
  const { cloudinary: cloudinaryConfig } = getEnv();
  const resourceType = getCloudinaryResourceType(file.mimetype);

  cloudinary.config({
    cloud_name: cloudinaryConfig.cloudName,
    api_key: cloudinaryConfig.apiKey,
    api_secret: cloudinaryConfig.apiSecret,
  });

  const uploadOptions = {
    folder: cloudinaryConfig.folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
  };

  const result = shouldUseChunkedUpload(file)
    ? await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(
          file.path,
          {
            ...uploadOptions,
            chunk_size: 8 * 1024 * 1024,
          },
          (error, uploadResult) => {
            if (error) reject(error);
            else resolve(uploadResult);
          },
        );
      })
    : await cloudinary.uploader.upload(file.path, uploadOptions);

  return {
    url: result.secure_url,
    provider: 'cloudinary',
    resourceType: result.resource_type,
    publicId: result.public_id,
  };
}

async function moveToLocalUploads(file, req) {
  await fs.mkdir(localUploadDir, { recursive: true });
  const safeName = `${Date.now()}-${file.filename}-${file.originalname.replace(/[^\w.-]/g, '_')}`;
  const finalPath = path.join(localUploadDir, safeName);
  await fs.rename(file.path, finalPath);

  return {
    url: `${req.protocol}://${req.get('host')}/uploads/${safeName}`,
    provider: 'local',
    resourceType: getCloudinaryResourceType(file.mimetype),
    publicId: safeName,
  };
}

async function storeUploadedFile(file, req) {
  const { cloudinary: cloudinaryConfig } = getEnv();

  try {
    if (hasCloudinaryConfig(cloudinaryConfig)) {
      return await uploadToCloudinary(file);
    }

    return await moveToLocalUploads(file, req);
  } finally {
    if (hasCloudinaryConfig(cloudinaryConfig)) {
      await deleteTempFile(file.path);
    }
  }
}

module.exports = {
  createCloudinarySignature,
  deleteTempFile,
  hasCloudinaryConfig,
  storeUploadedFile,
};
