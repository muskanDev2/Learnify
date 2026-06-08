const fs = require('fs/promises');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { getEnv } = require('../config/env');

const localUploadDir = path.join(process.cwd(), 'uploads');

function hasCloudinaryConfig(config) {
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

function getCloudinaryResourceType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}

async function deleteTempFile(filePath) {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => {});
}

async function uploadToCloudinary(file) {
  const { cloudinary: cloudinaryConfig } = getEnv();

  cloudinary.config({
    cloud_name: cloudinaryConfig.cloudName,
    api_key: cloudinaryConfig.apiKey,
    api_secret: cloudinaryConfig.apiSecret,
  });

  const result = await cloudinary.uploader.upload(file.path, {
    folder: cloudinaryConfig.folder,
    resource_type: getCloudinaryResourceType(file.mimetype),
    use_filename: true,
    unique_filename: true,
  });

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

module.exports = { deleteTempFile, storeUploadedFile };
