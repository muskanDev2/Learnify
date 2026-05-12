import { isAdmin, isInstructor, isStudent } from './authUtils';

/** @param {number[]} values */
export function mean(values) {
  const nums = values.filter((n) => Number.isFinite(n));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** @param {number[]} values */
export function median(values) {
  const nums = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function truncateLabel(text, maxLen = 20) {
  const s = String(text || '').trim() || 'Untitled';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function getCourseItemCount(course) {
  return (course.modules || []).reduce(
    (sum, module) => sum + ((module.items || []).length || 0),
    0,
  );
}

/**
 * Frequency table of user roles (mutually exclusive: admin > instructor > student).
 */
export function adminRoleFrequencies(users) {
  let students = 0;
  let instructors = 0;
  let admins = 0;
  users.forEach((user) => {
    if (isAdmin(user)) admins += 1;
    else if (isInstructor(user)) instructors += 1;
    else if (isStudent(user)) students += 1;
    else students += 1;
  });
  const total = users.length;
  return [
    {
      label: 'Students',
      count: students,
      pct: total ? Math.round((students / total) * 100) : 0,
    },
    {
      label: 'Instructors',
      count: instructors,
      pct: total ? Math.round((instructors / total) * 100) : 0,
    },
    {
      label: 'Admins',
      count: admins,
      pct: total ? Math.round((admins / total) * 100) : 0,
    },
  ].filter((row) => row.count > 0 || total === 0);
}

/**
 * Per-course enrollment counts with summary statistics across courses.
 */
export function adminEnrollmentByCourse(courses, enrollments, { maxBars = 10 } = {}) {
  const rows = courses.map((course) => {
    const enrollCount = Object.values(enrollments).reduce((sum, ids) => {
      if (!Array.isArray(ids)) return sum;
      return sum + (ids.includes(course.id) ? 1 : 0);
    }, 0);
    return {
      label: truncateLabel(course.title, 24),
      fullTitle: course.title || 'Untitled course',
      enrollments: enrollCount,
    };
  });

  const sorted = [...rows].sort((a, b) => b.enrollments - a.enrollments);
  const top = sorted.slice(0, maxBars);
  const counts = rows.map((r) => r.enrollments);
  return {
    rows: top,
    meanEnrollments: Math.round(mean(counts) * 10) / 10,
    medianEnrollments: Math.round(median(counts) * 10) / 10,
    courseCount: courses.length,
  };
}

/**
 * Instructor-owned courses: learners enrolled and assignment counts per course.
 */
export function instructorCourseLoadSeries(courses, enrollments, instructorEmail) {
  const email = String(instructorEmail || '').toLowerCase();
  const mine = courses.filter((c) => String(c.ownerEmail || '').toLowerCase() === email);
  return mine.map((course) => {
    const students = Object.values(enrollments).reduce((sum, ids) => {
      if (!Array.isArray(ids)) return sum;
      return sum + (ids.includes(course.id) ? 1 : 0);
    }, 0);
    const assignments = (course.modules || []).reduce(
      (sum, mod) =>
        sum + (mod.items || []).filter((item) => item.type === 'assignment').length,
      0,
    );
    return {
      label: truncateLabel(course.title, 22),
      fullTitle: course.title || 'Untitled course',
      students,
      assignments,
    };
  });
}

/**
 * Observed completion rate per enrolled course (completed items / total items).
 */
export function studentCompletionByCourse(studentEmail, courses, enrollments, studentProgress) {
  const se = String(studentEmail || '').toLowerCase();
  const enrolledIds = enrollments[se] || [];
  const enrolled = courses.filter((c) => enrolledIds.includes(c.id));
  return enrolled.map((course) => {
    const totalItems = getCourseItemCount(course);
    const completedMap = (studentProgress[se] || {})[course.id] || {};
    const completed = Object.values(completedMap).filter(Boolean).length;
    const pct = totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0;
    return {
      label: truncateLabel(course.title, 20),
      fullTitle: course.title || 'Untitled course',
      completionPct: pct,
      completed,
      totalItems,
    };
  });
}

const DUE_BUCKETS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'd0_7', label: 'Due in 0–7 d' },
  { key: 'd8_14', label: 'Due in 8–14 d' },
  { key: 'd15p', label: 'Due in 15+ d' },
  { key: 'none', label: 'No due date' },
];

/**
 * Ordinal buckets for assignment due dates (relative to now).
 * @param {{ dueAt?: string }[]} assignmentItems
 */
export function studentAssignmentDueBuckets(assignmentItems) {
  const now = Date.now();
  const counts = { overdue: 0, d0_7: 0, d8_14: 0, d15p: 0, none: 0 };
  assignmentItems.forEach((item) => {
    if (!item.dueAt) {
      counts.none += 1;
      return;
    }
    const t = new Date(item.dueAt).getTime();
    if (Number.isNaN(t)) {
      counts.none += 1;
      return;
    }
    const days = (t - now) / 86400000;
    if (days < 0) counts.overdue += 1;
    else if (days <= 7) counts.d0_7 += 1;
    else if (days <= 14) counts.d8_14 += 1;
    else counts.d15p += 1;
  });
  return DUE_BUCKETS.map((b) => ({
    label: b.label,
    count: counts[b.key],
  }));
}
