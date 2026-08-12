/**
 * Remove temp feature-dev users and all related data.
 * Usage: CONFIRM_REMOVE_TEMP_USERS=yes node scripts/removeTempFeatureData.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

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

const TEMP_EMAILS = ['huzaifa@gmail.com', 'deepak@gmail.com'];

async function main() {
  if (process.env.CONFIRM_REMOVE_TEMP_USERS !== 'yes') {
    console.error('Set CONFIRM_REMOVE_TEMP_USERS=yes to run.');
    process.exit(1);
  }

  const { mongoUri } = getEnv();
  await mongoose.connect(mongoUri);

  const tempUsers = await User.find({ email: { $in: TEMP_EMAILS } }).select('_id email');
  const tempUserIds = tempUsers.map((user) => user._id);
  const tempCourses = await Course.find({ ownerEmail: { $in: TEMP_EMAILS } }).select('id ownerEmail title');
  const tempCourseIds = tempCourses.map((course) => course.id);

  const results = {};

  if (tempCourseIds.length) {
    results.liveClassAttendances = (
      await LiveClassAttendance.deleteMany({ courseId: { $in: tempCourseIds } })
    ).deletedCount;
    results.liveclasses = (await LiveClass.deleteMany({ courseId: { $in: tempCourseIds } })).deletedCount;
    results.discussionreplies = (
      await DiscussionReply.deleteMany({ courseId: { $in: tempCourseIds } })
    ).deletedCount;
    results.discussions = (await Discussion.deleteMany({ courseId: { $in: tempCourseIds } })).deletedCount;
    results.assignmentsubmissions = (
      await AssignmentSubmission.deleteMany({ courseId: { $in: tempCourseIds } })
    ).deletedCount;
    results.quizattempts = (await QuizAttempt.deleteMany({ courseId: { $in: tempCourseIds } })).deletedCount;
    results.courseprogresses = (
      await CourseProgress.deleteMany({ courseId: { $in: tempCourseIds } })
    ).deletedCount;
    results.uploadassets = (await UploadAsset.deleteMany({ courseId: { $in: tempCourseIds } })).deletedCount;
  }

  results.certificates = (
    await Certificate.deleteMany({
      $or: [{ studentEmail: { $in: TEMP_EMAILS } }, { courseId: { $in: tempCourseIds } }],
    })
  ).deletedCount;

  results.progresses = (
    await Progress.deleteMany({ studentEmail: { $in: TEMP_EMAILS } })
  ).deletedCount;

  results.enrollments = (
    await Enrollment.deleteMany({
      $or: [{ studentEmail: { $in: TEMP_EMAILS } }, { courseId: { $in: tempCourseIds } }],
    })
  ).deletedCount;

  results.notifications = (
    await Notification.deleteMany({
      $or: [
        { recipientEmail: { $in: TEMP_EMAILS } },
        { 'metadata.studentEmail': { $in: TEMP_EMAILS } },
      ],
    })
  ).deletedCount;

  if (tempUserIds.length) {
    results.supportrequests = (
      await SupportRequest.deleteMany({ user: { $in: tempUserIds } })
    ).deletedCount;
    results.studentnotes = (await StudentNote.deleteMany({ student: { $in: tempUserIds } })).deletedCount;

    const conversations = await Conversation.find({ participants: { $in: tempUserIds } }).select('_id');
    const conversationIds = conversations.map((row) => row._id);
    if (conversationIds.length) {
      results.messages = (await Message.deleteMany({ conversation: { $in: conversationIds } })).deletedCount;
      results.conversations = (await Conversation.deleteMany({ _id: { $in: conversationIds } })).deletedCount;
    }
  }

  results.courses = tempCourseIds.length
    ? (await Course.deleteMany({ id: { $in: tempCourseIds } })).deletedCount
    : 0;

  results.users = (await User.deleteMany({ email: { $in: TEMP_EMAILS } })).deletedCount;

  await LmsSnapshot.deleteMany({});
  await LmsSnapshot.create({ key: 'main', courses: [], enrollments: {}, studentProgress: {} });

  const remaining = {
    users: await User.find().select('email role name'),
    courses: await Course.countDocuments(),
  };

  console.log(
    JSON.stringify(
      {
        success: true,
        removed: results,
        tempCourses: tempCourses.map((course) => ({ id: course.id, title: course.title })),
        remaining,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Temp user cleanup failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
