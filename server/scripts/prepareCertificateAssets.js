/**
 * One-off asset prep: remove dark backgrounds from logo PNGs.
 * Usage: node scripts/prepareCertificateAssets.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const serverAssets = path.join(__dirname, '../assets');
const clientAssets = path.join(__dirname, '../../client/public/certificate-assets');

async function removeDarkBackground(inputPath, outputPath, threshold = 40) {
  const image = sharp(inputPath).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);
}

async function copyAsset(fileName) {
  fs.copyFileSync(path.join(serverAssets, fileName), path.join(clientAssets, fileName));
}

async function main() {
  // Only GYN logo gets background removal. FMST logo must stay exactly as provided.
  for (const logo of ['gyn-logo.png']) {
    const filePath = path.join(serverAssets, logo);
    const tempPath = `${filePath}.tmp.png`;
    await removeDarkBackground(filePath, tempPath);
    fs.renameSync(tempPath, filePath);
    await copyAsset(logo);
    console.log('processed', logo);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
