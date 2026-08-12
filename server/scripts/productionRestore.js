/**
 * Restore MongoDB from a productionReset backup folder.
 *
 * Usage:
 *   CONFIRM_PRODUCTION_RESTORE=yes node scripts/productionRestore.js --dir=pre-reset-2026-...
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { getEnv } = require('../src/config/env');
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

const RESTORE_ORDER = [
  { name: 'users', model: User },
  { name: 'courses', model: Course },
  { name: 'uploadassets', model: UploadAsset },
  { name: 'lmssnapshots', model: LmsSnapshot },
  { name: 'enrollments', model: Enrollment },
  { name: 'courseprogresses', model: CourseProgress },
  { name: 'progresses', model: Progress },
  { name: 'quizattempts', model: QuizAttempt },
  { name: 'assignmentsubmissions', model: AssignmentSubmission },
  { name: 'certificates', model: Certificate },
  { name: 'supportrequests', model: SupportRequest },
  { name: 'studentnotes', model: StudentNote },
  { name: 'notifications', model: Notification },
  { name: 'discussions', model: Discussion },
  { name: 'discussionreplies', model: DiscussionReply },
  { name: 'conversations', model: Conversation },
  { name: 'messages', model: Message },
  { name: 'liveclasses', model: LiveClass },
  { name: 'liveclassattendances', model: LiveClassAttendance },
];

function getBackupDirArg() {
  const arg = process.argv.find((item) => item.startsWith('--dir='));
  if (!arg) {
    console.error('Provide --dir=<backup-folder-name>');
    process.exit(1);
  }
  return path.join(BACKUPS_ROOT, arg.split('=')[1]);
}

async function main() {
  if (process.env.CONFIRM_PRODUCTION_RESTORE !== 'yes') {
    console.error('Set CONFIRM_PRODUCTION_RESTORE=yes to restore.');
    process.exit(1);
  }

  const backupDir = getBackupDirArg();
  if (!fs.existsSync(backupDir)) {
    console.error('Backup folder not found:', backupDir);
    process.exit(1);
  }

  const { mongoUri } = getEnv();
  await mongoose.connect(mongoUri);

  for (const entry of [...RESTORE_ORDER].reverse()) {
    await entry.model.deleteMany({});
  }

  const restored = {};
  for (const entry of RESTORE_ORDER) {
    const filePath = path.join(backupDir, `${entry.name}.json`);
    if (!fs.existsSync(filePath)) continue;
    const docs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!docs.length) continue;
    await entry.model.insertMany(docs);
    restored[entry.name] = docs.length;
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        restored,
        note: 'Cloudinary files are NOT restored automatically. Re-upload or keep existing Cloudinary assets.',
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Restore failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
