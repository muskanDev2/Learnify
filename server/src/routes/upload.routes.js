const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { uploadFiles } = require('../controllers/upload.controller');
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

router.post(
  '/',
  requireAuth,
  requireRoles('admin', 'instructor', 'student'),
  upload.array('files', 10),
  handleMulterErrors,
  uploadFiles,
);

module.exports = router;
