const fs = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const { v2: cloudinary } = require('cloudinary');
const { getEnv } = require('../config/env');
const { hasCloudinaryConfig } = require('./upload.service');

const certificatesDir = path.join(process.cwd(), 'uploads', 'certificates');

const palette = {
  ink: '#0f172a',
  muted: '#475569',
  brand: '#2563eb',
  brandSoft: '#dbeafe',
  gold: '#b45309',
  border: '#1d4ed8',
};

function formatIssueDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function drawCertificate(doc, data) {
  const { width, height } = doc.page;

  // Outer + inner decorative border.
  doc.save();
  doc.lineWidth(6).strokeColor(palette.border).rect(24, 24, width - 48, height - 48).stroke();
  doc.lineWidth(1.5).strokeColor(palette.brand).rect(38, 38, width - 76, height - 76).stroke();
  doc.restore();

  const centerX = width / 2;

  // Brand lockup: logo mark + "Learnify" wordmark sitting inline (side by side), centered as a group.
  const markSize = 46;
  const markGap = 14;
  const wordmark = 'Learnify';
  const wordmarkSize = 26;
  const markY = 60;

  doc.font('Helvetica-Bold').fontSize(wordmarkSize);
  const wordmarkWidth = doc.widthOfString(wordmark, { characterSpacing: 1 });
  const lockupWidth = markSize + markGap + wordmarkWidth;
  const markX = centerX - lockupWidth / 2;

  doc.save();
  doc.roundedRect(markX, markY, markSize, markSize, 12).fill(palette.brand);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(26)
    .text('L', markX, markY + 9, { width: markSize, align: 'center' });
  doc.restore();

  doc
    .fillColor(palette.brand)
    .font('Helvetica-Bold')
    .fontSize(wordmarkSize)
    .text(wordmark, markX + markSize + markGap, markY + (markSize - wordmarkSize) / 2 + 2, {
      characterSpacing: 1,
      lineBreak: false,
    });

  // Title.
  doc
    .fillColor(palette.ink)
    .font('Helvetica-Bold')
    .fontSize(38)
    .text('CERTIFICATE OF COMPLETION', 0, markY + markSize + 34, {
      align: 'center',
      characterSpacing: 1.5,
    });

  // Gold divider.
  doc.save();
  doc.lineWidth(2).strokeColor(palette.gold);
  doc.moveTo(centerX - 70, markY + markSize + 86).lineTo(centerX + 70, markY + markSize + 86).stroke();
  doc.restore();

  let cursorY = markY + markSize + 110;

  doc
    .fillColor(palette.muted)
    .font('Helvetica')
    .fontSize(15)
    .text('This certifies that', 0, cursorY, { align: 'center' });

  cursorY += 34;
  doc
    .fillColor(palette.brand)
    .font('Helvetica-Bold')
    .fontSize(32)
    .text(data.studentName || 'Student', 0, cursorY, { align: 'center' });

  cursorY += 50;
  doc
    .fillColor(palette.muted)
    .font('Helvetica')
    .fontSize(15)
    .text('has successfully completed', 0, cursorY, { align: 'center' });

  cursorY += 32;
  doc
    .fillColor(palette.ink)
    .font('Helvetica-Bold')
    .fontSize(24)
    .text(data.courseTitle || 'Course', 60, cursorY, {
      align: 'center',
      width: width - 120,
    });

  // Footer: issue date + certificate id on the left, instructor signature block on the right.
  const footerBaseY = height - 90;

  doc
    .fillColor(palette.muted)
    .font('Helvetica')
    .fontSize(12)
    .text(`Issued on: ${formatIssueDate(data.issueDate)}`, 70, footerBaseY - 14);
  doc
    .fillColor(palette.muted)
    .font('Helvetica')
    .fontSize(11)
    .text(`Certificate ID: ${data.serialNumber}`, 70, footerBaseY + 6);

  // Instructor signature block (conventional bottom-right position).
  const sigWidth = 200;
  const sigX = width - 70 - sigWidth;
  const instructorName = data.instructorName || 'Course Instructor';

  doc
    .fillColor(palette.ink)
    .font('Helvetica-BoldOblique')
    .fontSize(16)
    .text(instructorName, sigX, footerBaseY - 32, { width: sigWidth, align: 'center' });

  doc.save();
  doc.lineWidth(1).strokeColor(palette.muted);
  doc.moveTo(sigX, footerBaseY - 6).lineTo(sigX + sigWidth, footerBaseY - 6).stroke();
  doc.restore();

  doc
    .fillColor(palette.muted)
    .font('Helvetica')
    .fontSize(11)
    .text('Course Instructor', sigX, footerBaseY, { width: sigWidth, align: 'center' });
}

function buildCertificatePdfBuffer(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawCertificate(doc, data);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function uploadBufferToCloudinary(buffer, publicId) {
  const { cloudinary: cloudinaryConfig } = getEnv();

  cloudinary.config({
    cloud_name: cloudinaryConfig.cloudName,
    api_key: cloudinaryConfig.apiKey,
    api_secret: cloudinaryConfig.apiSecret,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${cloudinaryConfig.folder}/certificates`,
        resource_type: 'raw',
        public_id: publicId,
        format: 'pdf',
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
}

async function saveBufferLocally(buffer, fileName, baseUrl) {
  await fs.mkdir(certificatesDir, { recursive: true });
  const finalPath = path.join(certificatesDir, fileName);
  await fs.writeFile(finalPath, buffer);
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  return `${normalizedBase}/uploads/certificates/${fileName}`;
}

/**
 * Generate the certificate PDF and persist it (Cloudinary when configured, local fallback otherwise).
 * Returns { url, provider }.
 */
async function generateAndStoreCertificate(data, baseUrl) {
  const buffer = await buildCertificatePdfBuffer(data);
  const publicId = `certificate-${data.courseId}-${slugify(data.studentEmail)}-${Date.now()}`;
  const { cloudinary: cloudinaryConfig } = getEnv();

  if (hasCloudinaryConfig(cloudinaryConfig)) {
    const result = await uploadBufferToCloudinary(buffer, publicId);
    return { url: result.secure_url, provider: 'cloudinary' };
  }

  const url = await saveBufferLocally(buffer, `${publicId}.pdf`, baseUrl);
  return { url, provider: 'local' };
}

module.exports = {
  generateAndStoreCertificate,
};
