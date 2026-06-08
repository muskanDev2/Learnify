const UploadAsset = require('../models/UploadAsset');
const { deleteTempFile, storeUploadedFile } = require('../services/upload.service');

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

module.exports = { uploadFiles };
