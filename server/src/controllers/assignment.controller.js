const AssignmentSubmission = require('../models/AssignmentSubmission');
const Progress = require('../models/Progress');
const User = require('../models/User');
const { createNotification } = require('../services/notification.service');
const { sanitizeSubmissionFiles } = require('../utils/sanitizeCoursePayload');
const { recalculateCourseProgress, resolveCourseById } = require('../utils/lmsProgress');

const supportedAssignmentFileTypes = new Set([
  'pdf',
  'doc',
  'docx',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'mp4',
  'mov',
  'avi',
  'ppt',
  'pptx',
  'zip',
  'rar',
]);
const defaultAssignmentMaxFileSizeMb = 250;

const mimeTypeToFileType = [
  [/^image\/jpeg$/, 'jpg'],
  [/^image\/png$/, 'png'],
  [/^image\/webp$/, 'webp'],
  [/^video\/mp4$/, 'mp4'],
  [/^video\/quicktime$/, 'mov'],
  [/^video\/x-msvideo$/, 'avi'],
  [/^application\/pdf$/, 'pdf'],
  [/^application\/msword$/, 'doc'],
  [/^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/, 'docx'],
  [/^text\/plain$/, 'txt'],
  [/^application\/vnd\.ms-powerpoint$/, 'ppt'],
  [/^application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation$/, 'pptx'],
  [/^application\/zip$/, 'zip'],
  [/^application\/x-rar-compressed$/, 'rar'],
];

function canManageCourse(user, course) {
  const role = String(user.role || '').toLowerCase();
  return role === 'admin' || String(course.ownerEmail || '').toLowerCase() === String(user.email || '').toLowerCase();
}

function findAssignment(course, assignmentItemId) {
  const targetId = String(assignmentItemId);
  return (course.modules || [])
    .flatMap((module) => module.items || [])
    .find((item) => String(item.id) === targetId && item.type === 'assignment');
}

function getAssignmentAllowedFileTypes(assignment) {
  const configured = Array.isArray(assignment.allowedFileTypes) ? assignment.allowedFileTypes : [];
  const normalized = configured.map((type) => String(type).toLowerCase().trim()).filter(Boolean);
  return normalized.length ? normalized : [...supportedAssignmentFileTypes];
}

function detectFileType(file) {
  const mimeType = String(file.mimeType || '').toLowerCase();
  const name = String(file.originalFilename || file.name || '').toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() : '';
  const match = mimeTypeToFileType.find(([pattern]) => pattern.test(mimeType));
  return match?.[1] || extension || 'file';
}

function getPreviewUrl(file) {
  const url = file.secureUrl || file.url || '';
  const publicId = file.cloudinaryPublicId || file.publicId || '';
  if (!url || !publicId || file.provider !== 'cloudinary') return url;
  if (String(file.resourceType || '').toLowerCase() === 'image') {
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_900/');
  }
  if (String(file.resourceType || '').toLowerCase() === 'video') {
    return url.replace('/upload/', '/upload/f_auto,q_auto,so_0/');
  }
  return url;
}

function normalizeSubmissionFile(file) {
  const fileType = detectFileType(file);
  const normalized = {
    id: String(file.id || file._id || file.publicId || file.url || file.name),
    url: file.secureUrl || file.url,
    secureUrl: file.secureUrl || file.url,
    publicId: file.cloudinaryPublicId || file.publicId || '',
    cloudinaryPublicId: file.cloudinaryPublicId || file.publicId || '',
    fileType,
    originalFilename: file.originalFilename || file.name || 'Submitted file',
    name: file.name || file.originalFilename || 'Submitted file',
    mimeType: file.mimeType || 'application/octet-stream',
    size: Number(file.size) || 0,
    resourceType: file.resourceType || 'raw',
    provider: file.provider || 'cloudinary',
    uploadedAt: file.uploadedAt || new Date(),
  };
  normalized.previewUrl = getPreviewUrl(normalized);
  normalized.thumbnailUrl = normalized.previewUrl;
  return normalized;
}

function getMaxFileSizeBytes(assignment) {
  const configuredMaxMb = Number(assignment.maxFileSizeMb || assignment.maxFileSize || defaultAssignmentMaxFileSizeMb);
  // Existing assignments were created when 25 MB was the default; treat that value as legacy default.
  const maxMb = configuredMaxMb === 25 ? defaultAssignmentMaxFileSizeMb : configuredMaxMb;
  return Math.max(1, maxMb) * 1024 * 1024;
}

function getSubmissionStatus({ assignment, submittedAt, isGraded = false }) {
  if (isGraded) return 'graded';
  if (assignment?.dueAt && submittedAt > new Date(assignment.dueAt)) return 'late';
  return 'submitted';
}

function validateSubmission({ assignment, files, existingSubmission }) {
  const normalizedFiles = sanitizeSubmissionFiles(files).map(normalizeSubmissionFile);
  const now = new Date();
  const dueDate = assignment.dueAt ? new Date(assignment.dueAt) : null;
  const isPastDue = dueDate && !Number.isNaN(dueDate.getTime()) && now > dueDate;

  if (assignment.requiresStudentUpload !== false && normalizedFiles.length === 0) {
    const error = new Error('Please upload at least one file before submitting.');
    error.statusCode = 400;
    throw error;
  }

  if (existingSubmission && assignment.allowResubmission === false) {
    const error = new Error('Resubmission is not allowed for this assignment.');
    error.statusCode = 409;
    throw error;
  }

  if (existingSubmission?.status === 'graded') {
    const error = new Error('Graded submissions cannot be replaced.');
    error.statusCode = 409;
    throw error;
  }

  if (existingSubmission && isPastDue) {
    const error = new Error('You cannot replace this submission after the deadline.');
    error.statusCode = 403;
    throw error;
  }

  if (assignment.submissionOpen === false && !(isPastDue && assignment.allowLateSubmission === true)) {
    const error = new Error('Submission is closed for this assignment.');
    error.statusCode = 403;
    throw error;
  }

  if (isPastDue && assignment.allowLateSubmission === false) {
    const error = new Error('Late submissions are not allowed for this assignment.');
    error.statusCode = 403;
    throw error;
  }

  const allowedTypes = new Set(getAssignmentAllowedFileTypes(assignment));
  const maxFileSizeBytes = getMaxFileSizeBytes(assignment);
  const invalidFile = normalizedFiles.find((file) => !allowedTypes.has(file.fileType));
  if (invalidFile) {
    const error = new Error(`${invalidFile.originalFilename} is not an allowed file type.`);
    error.statusCode = 400;
    throw error;
  }

  const oversizedFile = normalizedFiles.find((file) => file.size > maxFileSizeBytes);
  if (oversizedFile) {
    const error = new Error(`${oversizedFile.originalFilename} exceeds the assignment file size limit.`);
    error.statusCode = 400;
    throw error;
  }

  return normalizedFiles;
}

async function listCourseAssignments(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const assignments = (course.modules || []).flatMap((module) =>
      (module.items || [])
        .filter((item) => item.type === 'assignment')
        .map((item) => ({
          ...item,
          courseId: course.id,
          moduleId: module.id,
          moduleTitle: module.title,
          allowedFileTypes: getAssignmentAllowedFileTypes(item),
          maxFileSizeMb: Number(item.maxFileSizeMb || item.maxFileSize || defaultAssignmentMaxFileSizeMb),
          allowResubmission: item.allowResubmission !== false,
          allowLateSubmission: item.allowLateSubmission !== false,
        })),
    );

    return res.json({ success: true, data: assignments });
  } catch (error) {
    return next(error);
  }
}

async function createAssignment(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot create assignments for this course.' });
    }

    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ success: false, message: 'Assignment title is required.' });
    }

    const modules = Array.isArray(course.modules) && course.modules.length
      ? course.modules
      : [{ id: 1, title: 'General', items: [] }];
    const targetModuleId = req.body.moduleId || modules[0].id;
    const allItems = modules.flatMap((module) => module.items || []);
    const nextItemId = allItems.length ? Math.max(...allItems.map((item) => Number(item.id) || 0)) + 1 : 1;
    const assignment = {
      id: nextItemId,
      type: 'assignment',
      title,
      instructions: String(req.body.description || req.body.instructions || '').trim(),
      openedAt: req.body.openedAt || new Date().toISOString().slice(0, 16),
      dueAt: req.body.dueAt || req.body.dueDate || '',
      gradingStatus: req.body.gradingStatus || 'Points based',
      requiresStudentUpload: true,
      submissionOpen: true,
      fileSubmissionEnabled: true,
      allowedFileTypes: getAssignmentAllowedFileTypes(req.body),
      maxFileSizeMb: Number(req.body.maxFileSizeMb || req.body.maxFileSize || defaultAssignmentMaxFileSizeMb),
      allowResubmission: req.body.allowResubmission !== false,
      allowLateSubmission: req.body.allowLateSubmission !== false,
      attachments: [],
      submissions: [],
      createdBy: req.user._id,
      createdAt: new Date(),
      isDelivered: true,
    };

    course.modules = modules.map((module) =>
      String(module.id) === String(targetModuleId)
        ? { ...module, items: [...(module.items || []), assignment] }
        : module,
    );
    await course.save();

    return res.status(201).json({ success: true, message: 'Assignment created.', data: assignment });
  } catch (error) {
    return next(error);
  }
}

async function submitAssignment(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (String(req.user.role || '').toLowerCase() !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can submit assignments.' });
    }

    const assignment = findAssignment(course, req.params.assignmentItemId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const submittedAt = new Date();
    const existingSubmission = await AssignmentSubmission.findOne({
      student: req.user._id,
      course: course._id,
      assignmentItemId: req.params.assignmentItemId,
    });
    const normalizedFiles = validateSubmission({
      assignment,
      files: req.body.files,
      existingSubmission,
    });
    const primaryFile = normalizedFiles[0] || {};
    const status = getSubmissionStatus({ assignment, submittedAt });

    const submission = await AssignmentSubmission.findOneAndUpdate(
      { student: req.user._id, course: course._id, assignmentItemId: req.params.assignmentItemId },
      {
        $setOnInsert: {
          student: req.user._id,
          course: course._id,
          courseId: course.id,
          assignmentItemId: req.params.assignmentItemId,
        },
        $set: {
          textSubmission: req.body.textSubmission || '',
          files: normalizedFiles,
          fileUrl: primaryFile.secureUrl || primaryFile.url || '',
          cloudinaryPublicId: primaryFile.cloudinaryPublicId || primaryFile.publicId || '',
          fileType: primaryFile.fileType || '',
          originalFilename: primaryFile.originalFilename || '',
          submittedAt,
          status,
          grade: undefined,
          maxGrade: undefined,
          feedback: '',
          gradedAt: undefined,
          gradedBy: undefined,
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    await Progress.findOneAndUpdate(
      {
        $or: [
          { student: req.user._id, course: course._id, itemId: req.params.assignmentItemId },
          { studentEmail: req.user.email, courseId: course.id, itemId: req.params.assignmentItemId },
        ],
      },
      {
        $set: {
          student: req.user._id,
          course: course._id,
          studentEmail: req.user.email,
          courseId: course.id,
          itemId: req.params.assignmentItemId,
          itemType: 'assignment',
          completed: true,
          completedAt: submittedAt,
          lastActivityAt: submittedAt,
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    await recalculateCourseProgress(req.user, course);

    const instructor = await User.findOne({ email: String(course.ownerEmail || '').toLowerCase() }).select('_id');
    if (instructor) {
      createNotification(instructor._id, {
        title: 'Assignment submitted',
        message: `${req.user.name} submitted an assignment in ${course.title}.`,
        notificationType: 'assignment_submitted',
        relatedEntityId: submission._id,
        courseId: course.id,
        relatedEntityType: 'assignment_submission',
        actionUrl: `/courses?courseId=${course.id}&assignmentId=${assignment.id}`,
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: status === 'late' ? 'Late assignment submitted.' : 'Assignment submitted.',
      data: submission.toClient(),
    });
  } catch (error) {
    return next(error);
  }
}

async function getMySubmission(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const submission = await AssignmentSubmission.findOne({
      student: req.user._id,
      course: course._id,
      assignmentItemId: req.params.assignmentItemId,
    });

    return res.json({ success: true, data: submission ? submission.toClient() : null });
  } catch (error) {
    return next(error);
  }
}

async function listSubmissions(req, res, next) {
  try {
    const course = await resolveCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ success: false, message: 'You cannot view these submissions.' });
    }

    const submissions = await AssignmentSubmission.find({
      course: course._id,
      assignmentItemId: req.params.assignmentItemId,
    })
      .populate('student', 'name email')
      .sort({ submittedAt: -1 });

    return res.json({ success: true, data: submissions.map((submission) => submission.toClient()) });
  } catch (error) {
    return next(error);
  }
}

async function gradeSubmission(req, res, next) {
  try {
    const submission = await AssignmentSubmission.findById(req.params.id).populate('course');
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    if (!canManageCourse(req.user, submission.course)) {
      return res.status(403).json({ success: false, message: 'You cannot grade this submission.' });
    }

    submission.grade = String(req.body.grade || '').trim();
    submission.maxGrade = String(req.body.maxGrade || '').trim();
    submission.feedback = String(req.body.feedback || '').trim();
    submission.status = 'graded';
    submission.gradedBy = req.user._id;
    submission.gradedAt = new Date();
    await submission.save();

    createNotification(submission.student, {
      title: 'Assignment graded',
      message: `Your submission in ${submission.course.title} has been graded.`,
      notificationType: submission.feedback ? 'instructor_feedback_added' : 'assignment_graded',
      relatedEntityId: submission._id,
      courseId: submission.course.id,
      relatedEntityType: 'assignment_submission',
      actionUrl: `/courses?courseId=${submission.course.id}&assignmentId=${submission.assignmentItemId}`,
    }).catch(() => {});

    return res.json({ success: true, message: 'Submission graded.', data: submission.toClient() });
  } catch (error) {
    return next(error);
  }
}

async function deleteSubmission(req, res, next) {
  try {
    const submission = await AssignmentSubmission.findById(req.params.id).populate('course');
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    const isOwner = String(submission.student) === String(req.user._id);
    const isManager = canManageCourse(req.user, submission.course);
    if (!isOwner && !isManager) {
      return res.status(403).json({ success: false, message: 'You cannot delete this submission.' });
    }

    const assignment = findAssignment(submission.course, submission.assignmentItemId);
    const isPastDue = assignment?.dueAt && new Date() > new Date(assignment.dueAt);
    if (isOwner && (isPastDue || assignment?.allowResubmission === false)) {
      return res.status(403).json({ success: false, message: 'This submission can no longer be replaced.' });
    }

    await submission.deleteOne();
    return res.json({ success: true, message: 'Submission deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createAssignment,
  deleteSubmission,
  getMySubmission,
  gradeSubmission,
  listCourseAssignments,
  listSubmissions,
  submitAssignment,
};
