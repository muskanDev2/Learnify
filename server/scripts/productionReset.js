/**
 * ONE-TIME production database reset (Atlas).
 *
 * Requires:
 *   CONFIRM_PRODUCTION_RESET=yes
 *   GYN_ADMIN_PASSWORD
 *   GYN_INSTRUCTOR_PASSWORD
 *   GYN_STUDENT_PASSWORD
 *
 * Creates backup under server/backups/ before deleting anything.
 * Restore: node scripts/productionRestore.js --dir=<backup-folder-name>
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const { getEnv } = require('../src/config/env');
const { hasCloudinaryConfig } = require('../src/services/upload.service');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Enrollment = require('../src/models/Enrollment');
const Progress = require('../src/models/Progress');
const CourseProgress = require('../src/models/CourseProgress');
const QuizAttempt = require('../src/models/QuizAttempt');
const AssignmentSubmission = require('../src/models/AssignmentSubmission');
const Certificate = require('../src/models/Certificate');
const Notification = require('../src/models/Notification');
const UploadAsset = require('../src/models/UploadAsset');
const Discussion = require('../src/models/Discussion');
const DiscussionReply = require('../src/models/DiscussionReply');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const LiveClass = require('../src/models/LiveClass');
const LiveClassAttendance = require('../src/models/LiveClassAttendance');
const SupportRequest = require('../src/models/SupportRequest');
const StudentNote = require('../src/models/StudentNote');
const LmsSnapshot = require('../src/models/LmsSnapshot');

const BACKUPS_ROOT = path.join(__dirname, '../backups');

const COLLECTIONS = [
  { name: 'liveclassattendances', model: LiveClassAttendance },
  { name: 'liveclasses', model: LiveClass },
  { name: 'messages', model: Message },
  { name: 'conversations', model: Conversation },
  { name: 'discussionreplies', model: DiscussionReply },
  { name: 'discussions', model: Discussion },
  { name: 'notifications', model: Notification },
  { name: 'studentnotes', model: StudentNote },
  { name: 'supportrequests', model: SupportRequest },
  { name: 'certificates', model: Certificate },
  { name: 'assignmentsubmissions', model: AssignmentSubmission },
  { name: 'quizattempts', model: QuizAttempt },
  { name: 'progresses', model: Progress },
  { name: 'courseprogresses', model: CourseProgress },
  { name: 'enrollments', model: Enrollment },
  { name: 'lmssnapshots', model: LmsSnapshot },
  { name: 'uploadassets', model: UploadAsset },
  { name: 'courses', model: Course },
  { name: 'users', model: User, includePassword: true },
];

function requireConfirmation() {
  if (process.env.CONFIRM_PRODUCTION_RESET !== 'yes') {
    console.error('Set CONFIRM_PRODUCTION_RESET=yes to run this script.');
    process.exit(1);
  }

  const missing = ['GYN_ADMIN_PASSWORD', 'GYN_INSTRUCTOR_PASSWORD', 'GYN_STUDENT_PASSWORD'].filter(
    (key) => !process.env[key]?.trim(),
  );
  if (missing.length) {
    console.error(`Missing env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function publicIdFromCloudinaryUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return '';
  try {
    const withoutQuery = String(url).split('?')[0];
    const uploadIndex = withoutQuery.indexOf('/upload/');
    if (uploadIndex === -1) return '';
    let remainder = withoutQuery.slice(uploadIndex + '/upload/'.length);
    remainder = remainder.replace(/^v\d+\//, '');
    const lastDot = remainder.lastIndexOf('.');
    return lastDot > -1 ? remainder.slice(0, lastDot) : remainder;
  } catch {
    return '';
  }
}

async function backupCollection(dir, entry) {
  const query = entry.includePassword ? entry.model.find().select('+password') : entry.model.find();
  const docs = await query.lean();
  fs.writeFileSync(path.join(dir, `${entry.name}.json`), JSON.stringify(docs, null, 2));
  return docs.length;
}

async function collectCloudinaryAssets() {
  const assets = [];

  const uploads = await UploadAsset.find({ provider: 'cloudinary' }).lean();
  uploads.forEach((row) => {
    if (row.publicId) {
      assets.push({ publicId: row.publicId, resourceType: row.resourceType || 'raw' });
    }
  });

  const certificates = await Certificate.find({ provider: 'cloudinary' }).lean();
  certificates.forEach((row) => {
    const publicId = publicIdFromCloudinaryUrl(row.certificateUrl);
    if (publicId) assets.push({ publicId, resourceType: 'raw' });
  });

  const seen = new Set();
  return assets.filter((item) => {
    const key = `${item.resourceType}:${item.publicId}`;
    if (!item.publicId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function deleteCloudinaryAssets(assets, cloudinaryConfig) {
  if (!hasCloudinaryConfig(cloudinaryConfig) || !assets.length) {
    return { deleted: 0, failed: 0, skipped: assets.length };
  }

  cloudinary.config({
    cloud_name: cloudinaryConfig.cloudName,
    api_key: cloudinaryConfig.apiKey,
    api_secret: cloudinaryConfig.apiSecret,
  });

  let deleted = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      await cloudinary.uploader.destroy(asset.publicId, {
        resource_type: asset.resourceType === 'video' ? 'video' : asset.resourceType === 'image' ? 'image' : 'raw',
        invalidate: true,
      });
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return { deleted, failed, skipped: 0 };
}

async function createGynUsers() {
  const users = [
    {
      name: 'GYN Admin',
      email: 'gyn@gyn.com',
      password: process.env.GYN_ADMIN_PASSWORD.trim(),
      role: 'admin',
      active: true,
    },
    {
      name: 'GYN Instructor',
      email: 'instructor@gyn.com',
      password: process.env.GYN_INSTRUCTOR_PASSWORD.trim(),
      role: 'instructor',
      active: true,
    },
    {
      name: 'GYN Student',
      email: 'student@gyn.com',
      password: process.env.GYN_STUDENT_PASSWORD.trim(),
      role: 'student',
      degreeProgram: 'GYN Program',
      semester: 1,
      active: true,
    },
  ];

  const created = [];
  for (const data of users) {
    const user = await User.create(data);
    created.push({ email: user.email, role: user.role, id: String(user._id) });
  }
  return created;
}

async function main() {
  requireConfirmation();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUPS_ROOT, `pre-reset-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const { mongoUri, cloudinary: cloudinaryConfig } = getEnv();
  await mongoose.connect(mongoUri);

  console.log('Backing up database to', backupDir);

  const backupCounts = {};
  for (const entry of COLLECTIONS) {
    backupCounts[entry.name] = await backupCollection(backupDir, entry);
  }

  const cloudinaryAssets = await collectCloudinaryAssets();
  fs.writeFileSync(
    path.join(backupDir, 'cloudinary-assets.json'),
    JSON.stringify(cloudinaryAssets, null, 2),
  );

  const deleteCounts = {};
  for (const entry of COLLECTIONS.slice(0, -1)) {
    const result = await entry.model.deleteMany({});
    deleteCounts[entry.name] = result.deletedCount;
  }
  deleteCounts.users = (await User.deleteMany({})).deletedCount;

  const cloudinaryResult = await deleteCloudinaryAssets(cloudinaryAssets, cloudinaryConfig);

  const createdUsers = await createGynUsers();

  const manifest = {
    resetAt: new Date().toISOString(),
    backupDir: path.basename(backupDir),
    backupCounts,
    deleteCounts,
    cloudinaryAssets: cloudinaryAssets.length,
    cloudinaryDelete: cloudinaryResult,
    createdUsers,
    revertHint: `node scripts/productionRestore.js --dir=${path.basename(backupDir)}`,
  };

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(
    path.join(BACKUPS_ROOT, 'LATEST_RESET.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log(JSON.stringify({ success: true, ...manifest }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Production reset failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
