const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const multer = require('multer');
const {
  createCloudinaryAsset,
  getCloudinarySignature,
  uploadFiles,
} = require('../controllers/upload.controller');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { getEnv } = require('../config/env');

const tempUploadDir = path.join(os.tmpdir(), 'learnify-uploads');
fs.mkdirSync(tempUploadDir, { recursive: true });

const allowedMimeTypePrefixes = ['image/', 'video/', 'audio/'];
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'text/plain',
]);

const storage = multer.diskStorage({
  destination: tempUploadDir,
  filename(req, file, callback) {
    const token = crypto.randomBytes(12).toString('hex');
    callback(null, `${Date.now()}-${token}`);
  },
});

function fileFilter(req, file, callback) {
  const isAllowed =
    allowedMimeTypes.has(file.mimetype) ||
    allowedMimeTypePrefixes.some((prefix) => file.mimetype.startsWith(prefix));

  if (!isAllowed) {
    const error = new Error('Unsupported file type. Upload videos, images, PDFs, docs, PPTs, or text files.');
    error.status = 400;
    return callback(error);
  }

  return callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: getEnv().uploadMaxFileMb * 1024 * 1024,
    files: 10,
  },
});

const router = express.Router();

function formatMulterError(error) {
  if (error instanceof multer.MulterError) {
    return error.code === 'LIMIT_FILE_SIZE'
      ? `File is too large. Max size is ${getEnv().uploadMaxFileMb} MB.`
      : error.message;
  }

  return error.message || 'File upload failed.';
}

function runUpload(req, res, next) {
  upload.array('files', 10)(req, res, (error) => {
    if (!error) return next();

    const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
    return res.status(status).json({
      success: false,
      message: formatMulterError(error),
    });
  });
}

function handleMulterErrors(error, req, res, next) {
  if (!error) return next();

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Max size is ${getEnv().uploadMaxFileMb} MB.`
        : error.message;
    return res.status(400).json({ success: false, message });
  }

  return next(error);
}

router.get(
  '/cloudinary/signature',
  requireAuth,
  requireRoles('admin', 'instructor', 'student'),
  getCloudinarySignature,
);

router.post(
  '/cloudinary/assets',
  requireAuth,
  requireRoles('admin', 'instructor', 'student'),
  createCloudinaryAsset,
);

router.post(
  '/',
  requireAuth,
  requireRoles('admin', 'instructor', 'student'),
  runUpload,
  handleMulterErrors,
  uploadFiles,
);

module.exports = router;
