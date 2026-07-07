const AssignmentSubmission = require('../models/AssignmentSubmission');
const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const QuizAttempt = require('../models/QuizAttempt');

function getCourseItems(course) {
  return (course.modules || []).flatMap((module) =>
    (module.items || []).map((item) => ({
      ...item,
      moduleId: module.id,
    })),
  );
}

async function resolveCourseById(courseId) {
  const numericCourseId = Number(courseId);
  if (!numericCourseId) return null;
  return Course.findOne({ id: numericCourseId });
}

async function ensureActiveEnrollment(student, course) {
  const studentEmail = String(student.email || '').toLowerCase();

  return Enrollment.findOneAndUpdate(
    {
      $or: [
        { student: student._id, course: course._id },
        { studentEmail, courseId: course.id },
      ],
    },
    {
      $set: {
        student: student._id,
        course: course._id,
        studentEmail,
        courseId: course.id,
        status: 'active',
        lastActivityAt: new Date(),
      },
      $setOnInsert: {
        enrolledAt: new Date(),
      },
    },
    { returnDocument: 'after', upsert: true },
  );
}

async function recalculateCourseProgress(student, course) {
  const enrollment = await ensureActiveEnrollment(student, course);
  const items = getCourseItems(course);
  const totalItems = items.length;
  const assignmentItems = items.filter((item) => item.type === 'assignment');

  const completedRows = await Progress.find({
    student: student._id,
    course: course._id,
    completed: true,
  });
  const completedIds = new Set(completedRows.map((row) => String(row.itemId)));

  const quizAttempts = await QuizAttempt.find({
    student: student._id,
    course: course._id,
  });
  quizAttempts.forEach((attempt) => {
    if (attempt.percentage >= 50 || attempt.status === 'submitted' || attempt.status === 'timed_out') {
      completedIds.add(String(attempt.quizItemId));
    }
  });

  const submissions = await AssignmentSubmission.find({
    student: student._id,
    course: course._id,
  });
  submissions.forEach((submission) => {
    completedIds.add(String(submission.assignmentItemId));
  });

  const completedItems = items.filter((item) => completedIds.has(String(item.id))).length;
  const progressPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
  const quizAverage = quizAttempts.length
    ? Math.round(
        quizAttempts.reduce((sum, attempt) => sum + (Number(attempt.percentage) || 0), 0) /
          quizAttempts.length,
      )
    : 0;

  const progress = await CourseProgress.findOneAndUpdate(
    { student: student._id, course: course._id },
    {
      $set: {
        student: student._id,
        course: course._id,
        courseId: course.id,
        enrollment: enrollment._id,
        totalItems,
        completedItems,
        progressPercent,
        quizAverage,
        assignmentSubmittedCount: submissions.length,
        assignmentTotalCount: assignmentItems.length,
        lastActivityAt: new Date(),
      },
    },
    { returnDocument: 'after', upsert: true },
  );

  await Enrollment.updateOne(
    { _id: enrollment._id },
    {
      $set: {
        progressPercent,
        lastActivityAt: new Date(),
        ...(progressPercent >= 100 ? { status: 'completed', completedAt: new Date() } : {}),
      },
    },
  );

  if (progressPercent >= 100) {
    // Run certificate generation asynchronously so we do not block user actions
    (async () => {
      try {
        const Certificate = require('../models/Certificate');
        let certificate = await Certificate.findOne({ student: student._id, course: course._id });

        if (!certificate || !certificate.certificateApproved || !certificate.certificateUrl) {
          const User = require('../models/User');
          const { generateAndStoreCertificate } = require('../services/certificate.service');
          const { createNotification } = require('../services/notification.service');

          // Fetch full student details to ensure name and email are present
          const studentDoc = await User.findById(student._id);
          if (!studentDoc) return;

          const courseOwner = await User.findOne({ email: String(course.ownerEmail || '').toLowerCase() }).select('_id name');
          const instructorName = courseOwner?.name || course.instructor || 'Course Instructor';
          const approvedBy = courseOwner?._id || null;

          const issueDate = certificate?.issueDate || new Date();
          const serialNumber =
            certificate?.serialNumber || `LRN-${course.id}-${String(student._id).slice(-6).toUpperCase()}`;

          if (!certificate) {
            certificate = new Certificate({ student: student._id, course: course._id });
          }

          certificate.studentEmail = String(studentDoc.email).toLowerCase();
          certificate.courseId = course.id;
          certificate.studentName = studentDoc.name || studentDoc.email;
          certificate.courseTitle = course.title;
          certificate.instructorName = instructorName;
          certificate.certificateApproved = true;
          if (approvedBy) {
            certificate.approvedBy = approvedBy;
          }
          certificate.approvedAt = new Date();
          certificate.progressAtApproval = progressPercent;
          certificate.serialNumber = serialNumber;
          certificate.issueDate = issueDate;

          const getAutoCertificateBaseUrl = () => {
            if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
            if (process.env.NODE_ENV === 'production') {
              return 'https://learnify-api-2con.onrender.com';
            }
            return `http://localhost:${process.env.PORT || 5000}`;
          };
          const baseUrl = getAutoCertificateBaseUrl();
          const stored = await generateAndStoreCertificate(
            {
              studentName: certificate.studentName,
              courseTitle: certificate.courseTitle,
              instructorName,
              issueDate,
              serialNumber,
              courseId: course.id,
              studentEmail: certificate.studentEmail,
            },
            baseUrl,
          );
          certificate.certificateUrl = stored.url;
          certificate.provider = stored.provider;

          await certificate.save();

          await createNotification(student._id, {
            title: 'Certificate earned!',
            message: `Congratulations! You completed ${course.title} and your certificate is ready.`,
            notificationType: 'certificate_approved',
            relatedEntityId: course.id,
            relatedEntityType: 'course',
            courseId: course.id,
            actionUrl: '/dashboard?tab=progress',
            dedupeKey: `certificate-${course.id}-${certificate.studentEmail}`,
          }).catch(() => {});
        }
      } catch (certError) {
        console.error('Error auto-generating certificate on completion:', certError);
      }
    })();
  }

  return progress;
}

async function getProgressMap(filter = {}) {
  const rows = await Progress.find(filter);
  return rows.reduce((map, row) => {
    const email = row.studentEmail;
    const courseId = String(row.courseId);
    const itemId = String(row.itemId);

    if (!map[email]) map[email] = {};
    if (!map[email][courseId]) map[email][courseId] = {};

    map[email][courseId][itemId] = Boolean(row.completed);
    return map;
  }, {});
}

module.exports = {
  ensureActiveEnrollment,
  getCourseItems,
  getProgressMap,
  recalculateCourseProgress,
  resolveCourseById,
};
