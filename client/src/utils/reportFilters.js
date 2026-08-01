/** Shared admin report filter shape (extend with department, instructor, etc.). */

export const DEFAULT_ADMIN_REPORT_FILTER = {
  courseId: 'all',
  period: 'all_time',
};

export function adminReportFilterToQueryParams(filter = DEFAULT_ADMIN_REPORT_FILTER) {
  const params = new URLSearchParams();
  const courseId = filter.courseId;
  if (courseId !== undefined && courseId !== null && String(courseId) !== '' && String(courseId) !== 'all') {
    params.set('courseId', String(courseId));
  }

  params.set('period', filter.period || 'all_time');
  if (filter.period === 'specific_month') {
    params.set('month', String(filter.month || new Date().getMonth() + 1));
    params.set('year', String(filter.year || new Date().getFullYear()));
  }

  return params;
}

export function mergeReportFilter(previous, partial) {
  const next = { ...previous, ...partial };
  if (partial.period && partial.period !== 'specific_month') {
    next.month = undefined;
    next.year = undefined;
  }
  return next;
}
