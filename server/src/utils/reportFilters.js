const { parseReportDateRange } = require('./reportDateRange');

/**
 * Parses admin report query params (extensible: add department, instructor, category later).
 */
function parseReportFilters(query = {}) {
  const dateRange = parseReportDateRange(query);

  let courseId = null;
  const rawCourseId = query.courseId;
  if (rawCourseId !== undefined && rawCourseId !== null && String(rawCourseId).trim() !== '') {
    const normalized = String(rawCourseId).trim().toLowerCase();
    if (normalized !== 'all') {
      const parsed = Number(rawCourseId);
      if (Number.isFinite(parsed) && parsed > 0) {
        courseId = parsed;
      }
    }
  }

  return {
    ...dateRange,
    courseId,
  };
}

module.exports = {
  parseReportFilters,
};
