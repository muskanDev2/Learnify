function isVideoFile(value) {
  const mimeType = String(value?.mimeType || '').toLowerCase();
  const name = String(value?.name || '').toLowerCase();
  return mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/.test(name);
}

function isLegacyVideoFile(value) {
  if (!value || typeof value !== 'object' || !isVideoFile(value)) return false;
  return !value.url && !value.publicId;
}

function sanitizePayload(value, parentKey = '') {
  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizePayload(item, parentKey))
      .filter((item) => item !== null);

    if (['files', 'attachments'].includes(parentKey)) {
      return sanitizedItems.filter((item) => !isLegacyVideoFile(item));
    }

    return sanitizedItems;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((next, [key, childValue]) => {
    // Never persist base64/blob payloads in MongoDB. Store file URLs/metadata only.
    if (key === 'dataUrl') {
      return next;
    }

    next[key] = sanitizePayload(childValue, key);
    return next;
  }, {});
}

function sanitizeCourseModules(modules) {
  if (!Array.isArray(modules)) return [];
  return sanitizePayload(modules);
}

function sanitizeCourses(courses) {
  if (!Array.isArray(courses)) return [];
  return courses.map((course) => ({
    ...course,
    modules: sanitizeCourseModules(course.modules),
  }));
}

function sanitizeSubmissionFiles(files) {
  if (!Array.isArray(files)) return [];
  return sanitizePayload(files, 'files');
}

async function removeLegacyCourseDataUrls(Course) {
  const operations = [
    {
      update: { $unset: { 'modules.$[module].items.$[item].files.$[file].dataUrl': '' } },
      options: {
        arrayFilters: [
          { 'module.items': { $exists: true } },
          { 'item.files': { $exists: true } },
          { 'file.dataUrl': { $exists: true } },
        ],
      },
    },
    {
      update: { $unset: { 'modules.$[module].items.$[item].attachments.$[file].dataUrl': '' } },
      options: {
        arrayFilters: [
          { 'module.items': { $exists: true } },
          { 'item.attachments': { $exists: true } },
          { 'file.dataUrl': { $exists: true } },
        ],
      },
    },
    {
      update: { $unset: { 'modules.$[module].items.$[item].submissions.$[submission].files.$[file].dataUrl': '' } },
      options: {
        arrayFilters: [
          { 'module.items': { $exists: true } },
          { 'item.submissions': { $exists: true } },
          { 'submission.files': { $exists: true } },
          { 'file.dataUrl': { $exists: true } },
        ],
      },
    },
    {
      update: { $unset: { 'modules.$[module].materials.$[material].dataUrl': '' } },
      options: {
        arrayFilters: [
          { 'module.materials': { $exists: true } },
          { 'material.dataUrl': { $exists: true } },
        ],
      },
    },
  ];

  const results = [];
  for (const operation of operations) {
    results.push(await Course.updateMany({}, operation.update, operation.options));
  }

  return {
    matchedCount: results.reduce((sum, result) => sum + (result.matchedCount || 0), 0),
    modifiedCount: results.reduce((sum, result) => sum + (result.modifiedCount || 0), 0),
  };
}

async function removeLegacySnapshotDataUrls(LmsSnapshot) {
  const operations = [
    {
      update: { $unset: { 'courses.$[course].modules.$[module].items.$[item].files.$[file].dataUrl': '' } },
      options: {
        arrayFilters: [
          { 'course.modules': { $exists: true } },
          { 'module.items': { $exists: true } },
          { 'item.files': { $exists: true } },
          { 'file.dataUrl': { $exists: true } },
        ],
      },
    },
    {
      update: { $unset: { 'courses.$[course].modules.$[module].items.$[item].attachments.$[file].dataUrl': '' } },
      options: {
        arrayFilters: [
          { 'course.modules': { $exists: true } },
          { 'module.items': { $exists: true } },
          { 'item.attachments': { $exists: true } },
          { 'file.dataUrl': { $exists: true } },
        ],
      },
    },
    {
      update: {
        $unset: {
          'courses.$[course].modules.$[module].items.$[item].submissions.$[submission].files.$[file].dataUrl': '',
        },
      },
      options: {
        arrayFilters: [
          { 'course.modules': { $exists: true } },
          { 'module.items': { $exists: true } },
          { 'item.submissions': { $exists: true } },
          { 'submission.files': { $exists: true } },
          { 'file.dataUrl': { $exists: true } },
        ],
      },
    },
    {
      update: { $unset: { 'courses.$[course].modules.$[module].materials.$[material].dataUrl': '' } },
      options: {
        arrayFilters: [
          { 'course.modules': { $exists: true } },
          { 'module.materials': { $exists: true } },
          { 'material.dataUrl': { $exists: true } },
        ],
      },
    },
  ];

  const results = [];
  for (const operation of operations) {
    results.push(await LmsSnapshot.updateMany({}, operation.update, operation.options));
  }

  return {
    matchedCount: results.reduce((sum, result) => sum + (result.matchedCount || 0), 0),
    modifiedCount: results.reduce((sum, result) => sum + (result.modifiedCount || 0), 0),
  };
}

async function removeLegacySubmissionDataUrls(AssignmentSubmission) {
  return AssignmentSubmission.updateMany(
    { 'files.dataUrl': { $exists: true } },
    { $unset: { 'files.$[file].dataUrl': '' } },
    { arrayFilters: [{ 'file.dataUrl': { $exists: true } }] },
  );
}

async function compactSanitizedCourseDocuments(Course) {
  const courses = await Course.find().select('id modules');
  let modifiedCount = 0;

  for (const course of courses) {
    const sanitizedModules = sanitizeCourseModules(course.modules);
    if (JSON.stringify(sanitizedModules) !== JSON.stringify(course.modules || [])) {
      course.modules = sanitizedModules;
      await course.save();
      modifiedCount += 1;
    }
  }

  return { matchedCount: courses.length, modifiedCount };
}

async function compactSanitizedSnapshotDocuments(LmsSnapshot) {
  const snapshots = await LmsSnapshot.find().select('courses');
  let modifiedCount = 0;

  for (const snapshot of snapshots) {
    const sanitizedCourses = sanitizeCourses(snapshot.courses || []);
    if (JSON.stringify(sanitizedCourses) !== JSON.stringify(snapshot.courses || [])) {
      snapshot.courses = sanitizedCourses;
      await snapshot.save();
      modifiedCount += 1;
    }
  }

  return { matchedCount: snapshots.length, modifiedCount };
}

async function compactSanitizedSubmissionDocuments(AssignmentSubmission) {
  const submissions = await AssignmentSubmission.find().select('files');
  let modifiedCount = 0;

  for (const submission of submissions) {
    const sanitizedFiles = sanitizeSubmissionFiles(submission.files || []);
    if (JSON.stringify(sanitizedFiles) !== JSON.stringify(submission.files || [])) {
      submission.files = sanitizedFiles;
      await submission.save();
      modifiedCount += 1;
    }
  }

  return { matchedCount: submissions.length, modifiedCount };
}

async function cleanupLegacyEmbeddedFilePayloads({ AssignmentSubmission, Course, LmsSnapshot }) {
  const results = {
    courseDataUrls: await removeLegacyCourseDataUrls(Course),
    snapshotDataUrls: await removeLegacySnapshotDataUrls(LmsSnapshot),
    submissionDataUrls: await removeLegacySubmissionDataUrls(AssignmentSubmission),
    compactedCourses: await compactSanitizedCourseDocuments(Course),
    compactedSnapshots: await compactSanitizedSnapshotDocuments(LmsSnapshot),
    compactedSubmissions: await compactSanitizedSubmissionDocuments(AssignmentSubmission),
  };

  return results;
}

module.exports = {
  cleanupLegacyEmbeddedFilePayloads,
  removeLegacyCourseDataUrls,
  sanitizeCourseModules,
  sanitizeCourses,
  sanitizeSubmissionFiles,
};
