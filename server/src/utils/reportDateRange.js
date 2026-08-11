const PRESET_PERIODS = new Set([
  'today',
  'this_week',
  'this_month',
  'last_3_months',
  'last_6_months',
  'this_year',
  'all_time',
  'specific_month',
]);

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function parseReportDateRange(query = {}) {
  const period = String(query.period || 'all_time').toLowerCase();
  const now = new Date();

  if (!PRESET_PERIODS.has(period)) {
    return { start: null, end: null, period: 'all_time', label: 'All time' };
  }

  if (period === 'all_time') {
    return { start: null, end: null, period, label: 'All time' };
  }

  if (period === 'today') {
    return {
      start: startOfDay(now),
      end: endOfDay(now),
      period,
      label: 'Today',
    };
  }

  if (period === 'this_week') {
    return {
      start: startOfWeek(now),
      end: endOfDay(now),
      period,
      label: 'This week',
    };
  }

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start,
      end: endOfDay(now),
      period,
      label: 'This month',
    };
  }

  if (period === 'last_3_months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return {
      start: startOfDay(start),
      end: endOfDay(now),
      period,
      label: 'Last 3 months',
    };
  }

  if (period === 'last_6_months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    return {
      start: startOfDay(start),
      end: endOfDay(now),
      period,
      label: 'Last 6 months',
    };
  }

  if (period === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return {
      start,
      end: endOfDay(now),
      period,
      label: 'This year',
    };
  }

  if (period === 'specific_month') {
    const month = Number(query.month);
    const year = Number(query.year);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
      return { start: null, end: null, period: 'all_time', label: 'All time' };
    }
    const start = new Date(year, month - 1, 1);
    const end = endOfDay(new Date(year, month, 0));
    const monthName = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return { start, end, period, label: monthName };
  }

  return { start: null, end: null, period: 'all_time', label: 'All time' };
}

function enrollmentDateInRange(enrollment, start, end) {
  const date = enrollment.enrolledAt || enrollment.createdAt;
  if (!date) return false;
  const value = new Date(date);
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
}

function progressCompletedInRange(progressRow, start, end) {
  if (Number(progressRow.progressPercent) < 100) return false;
  const date = progressRow.updatedAt || progressRow.lastActivityAt || progressRow.createdAt;
  if (!date) return false;
  const value = new Date(date);
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
}

module.exports = {
  enrollmentDateInRange,
  parseReportDateRange,
  progressCompletedInRange,
};
