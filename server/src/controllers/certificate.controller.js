const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { recalculateCourseProgress } = require('../utils/lmsProgress');
const { generateAndStoreCertificate } = require('../services/certificate.service');
const { createNotification } = require('../services/notification.service');

function isAdminUser(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function ownsCourse(user, course) {
  if (isAdminUser(user)) return true;
  return (
    String(user?.role || '').toLowerCase() === 'instructor' &&
    String(course.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase()
  );
}

function getStatus(progressPercent) {
  return Number(progressPercent) >= 100 ? 'COMPLETED' : 'IN_PROGRESS';
}

async function listInstructorOverview(req, res, next) {
  try {
    const courseFilter = isAdminUser(req.user)
      ? {}
      : { ownerEmail: String(req.user.email || '').toLowerCase() };

    const courses = await Course.find(courseFilter);
    const courseIds = courses.map((course) => course.id);
    const courseById = new Map(courses.map((course) => [course.id, course]));

    if (!courseIds.length) {
      return res.json({ success: true, data: [] });
    }

    const enrollments = await Enrollment.find({
      courseId: { $in: courseIds },
      status: { $ne: 'dropped' },
    }).select('studentEmail courseId student');

    const emails = [
      ...new Set(enrollments.map((row) => String(row.studentEmail || '').toLowerCase()).filter(Boolean)),
    ];
    const students = await User.find({ email: { $in: emails }, role: 'student', active: { $ne: false } }).select(
      '_id name email',
    );
    const studentByEmail = new Map(students.map((student) => [String(student.email).toLowerCase(), student]));

    const progressRows = await CourseProgress.find({ courseId: { $in: courseIds } }).select(
      'student courseId progressPercent',
    );
    const progressByKey = new Map();
    progressRows.forEach((row) => {
      progressByKey.set(`${row.courseId}:${String(row.student)}`, row.progressPercent);
    });

    const certificates = await Certificate.find({ courseId: { $in: courseIds } });
    const certByKey = new Map();
    certificates.forEach((cert) => {
      certByKey.set(`${cert.courseId}:${String(cert.studentEmail).toLowerCase()}`, cert);
    });

    const seen = new Set();
    const data = [];
    enrollments.forEach((enrollment) => {
      const email = String(enrollment.studentEmail || '').toLowerCase();
      const student = studentByEmail.get(email);
      if (!student) return;

      const courseId = enrollment.courseId;
      const dedupe = `${courseId}:${email}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);

      const progressPercent = progressByKey.get(`${courseId}:${String(student._id)}`) ?? 0;
      const cert = certByKey.get(dedupe);

      data.push({
        courseId,
        courseTitle: courseById.get(courseId)?.title || 'Course',
        studentEmail: email,
        studentName: student.name || email,
        progressPercent,
        status: getStatus(progressPercent),
        certificateApproved: Boolean(cert?.certificateApproved),
        certificateUrl: cert?.certificateUrl || '',
      });
    });

    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function approveCertificate(req, res, next) {
  try {
    const courseId = Number(req.body.courseId);
    const studentEmail = String(req.body.studentEmail || '').toLowerCase().trim();
    const studentId = req.body.studentId;
    const override = req.body.override === true;

    if (!courseId || (!studentEmail && !studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Course id and student are required.',
      });
    }

    const course = await Course.findOne({ id: courseId });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!ownsCourse(req.user, course)) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve certificates for your own courses.',
      });
    }

    const student = studentId ? await User.findById(studentId) : await User.findOne({ email: studentEmail });
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    // Authoritative re-check: never trust client-side progress.
    // By default we require 100%, but the course owner/admin may explicitly
    // override and issue the certificate early (e.g. a lowered completion threshold).
    const progress = await recalculateCourseProgress(student, course);
    if (Number(progress.progressPercent) < 100 && !override) {
      return res.status(400).json({
        success: false,
        message: `This student has not completed the course yet (current progress ${progress.progressPercent}%).`,
      });
    }

    // Instructor name for the certificate signature: prefer the course owner's account name.
    const courseOwner = await User.findOne({ email: String(course.ownerEmail || '').toLowerCase() }).select('name');
    const instructorName = courseOwner?.name || course.instructor || req.user.name || 'Course Instructor';

    let certificate = await Certificate.findOne({ student: student._id, course: course._id });
    const issueDate = certificate?.issueDate || new Date();
    const serialNumber =
      certificate?.serialNumber || `LRN-${courseId}-${String(student._id).slice(-6).toUpperCase()}`;

    if (!certificate) {
      certificate = new Certificate({ student: student._id, course: course._id });
    }

    certificate.studentEmail = String(student.email).toLowerCase();
    certificate.courseId = courseId;
    certificate.studentName = student.name || student.email;
    certificate.courseTitle = course.title;
    certificate.instructorName = instructorName;
    certificate.certificateApproved = true;
    certificate.approvedBy = req.user._id;
    certificate.approvedAt = new Date();
    certificate.progressAtApproval = progress.progressPercent;
    certificate.serialNumber = serialNumber;
    certificate.issueDate = issueDate;

    if (!certificate.certificateUrl) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const stored = await generateAndStoreCertificate(
        {
          studentName: certificate.studentName,
          courseTitle: certificate.courseTitle,
          instructorName,
          issueDate,
          serialNumber,
          courseId,
          studentEmail: certificate.studentEmail,
        },
        baseUrl,
      );
      certificate.certificateUrl = stored.url;
      certificate.provider = stored.provider;
    }

    await certificate.save();

    createNotification(student._id, {
      title: 'Certificate ready to download',
      message: `Your certificate for ${course.title} has been approved. You can download it now.`,
      notificationType: 'certificate_approved',
      relatedEntityId: course.id,
      relatedEntityType: 'course',
      courseId: course.id,
      actionUrl: '/dashboard?tab=progress',
      dedupeKey: `certificate-${course.id}-${certificate.studentEmail}`,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Certificate approved successfully.',
      data: certificate.toClient(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Certificate.findOne({ courseId: Number(req.body.courseId) }).catch(() => null);
      if (existing) {
        return res.json({ success: true, message: 'Certificate already approved.', data: existing.toClient() });
      }
    }
    return next(error);
  }
}

async function listMyCertificates(req, res, next) {
  try {
    const certificates = await Certificate.find({
      student: req.user._id,
      certificateApproved: true,
    }).sort({ approvedAt: -1 });

    return res.json({
      success: true,
      data: certificates.map((certificate) => certificate.toClient()),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  approveCertificate,
  listInstructorOverview,
  listMyCertificates,
};
