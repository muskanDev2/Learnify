const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../../assets');

const ASSET_FILES = {
  gynLogo: 'gyn-logo.png',
  fmstLogo: 'fmst-logo.png',
  signatureSaba: 'signature-saba.png',
  signatureShazil: 'signature-shazil.png',
};

const cache = {};

function mimeForExt(ext) {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function loadAssetDataUri(fileName) {
  if (cache[fileName]) return cache[fileName];

  const filePath = path.join(assetsDir, fileName);
  const buffer = fs.readFileSync(filePath);
  const mime = mimeForExt(path.extname(fileName).toLowerCase());
  const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
  cache[fileName] = dataUri;
  return dataUri;
}

function getCertificateAssetUris() {
  return {
    gynLogo: loadAssetDataUri(ASSET_FILES.gynLogo),
    fmstLogo: loadAssetDataUri(ASSET_FILES.fmstLogo),
    signatureSaba: loadAssetDataUri(ASSET_FILES.signatureSaba),
    signatureShazil: loadAssetDataUri(ASSET_FILES.signatureShazil),
  };
}

module.exports = {
  getCertificateAssetUris,
};
