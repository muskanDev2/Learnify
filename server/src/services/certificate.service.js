const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');
const { v2: cloudinary } = require('cloudinary');
const { getEnv } = require('../config/env');
const { hasCloudinaryConfig } = require('./upload.service');
const { buildCertificateHtml } = require('../templates/certificateHtml');

const certificatesDir = path.join(process.cwd(), 'uploads', 'certificates');

let browserPromise = null;

const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--font-render-hinting=none',
];

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: PUPPETEER_ARGS,
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }
  return browserPromise;
}

async function buildCertificatePdfBuffer(data) {
  const html = buildCertificateHtml(data);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
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
    return { url: result.secure_url, provider: 'cloudinary', buffer };
  }

  const url = await saveBufferLocally(buffer, `${publicId}.pdf`, baseUrl);
  return { url, provider: 'local', buffer };
}

function certificateToPdfData(certificate, course) {
  return {
    studentName: certificate.studentName,
    courseTitle: certificate.courseTitle,
    instructorName: certificate.instructorName,
    programDirectorName: course?.instructor || certificate.instructorName,
    issueDate: certificate.issueDate || certificate.approvedAt || new Date(),
    serialNumber: certificate.serialNumber,
    studentEmail: certificate.studentEmail,
  };
}

/** Always uses the current HTML template (Future Minds design). */
async function buildPdfBufferForCertificate(certificate) {
  const Course = require('../models/Course');
  const course = await Course.findOne({ id: certificate.courseId });
  return buildCertificatePdfBuffer(certificateToPdfData(certificate, course));
}

module.exports = {
  buildPdfBufferForCertificate,
  generateAndStoreCertificate,
};
