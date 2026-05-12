import { useMemo } from 'react';
import { getStoredUsers } from '../utils/authUtils';

const COURSES_KEY = 'learnify_courses';
const ENROLLMENTS_KEY = 'learnify_enrollments';
const STUDENT_PROGRESS_KEY = 'learnify_student_progress';

function getStoredCourses() {
  const raw = localStorage.getItem(COURSES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStoredEnrollments() {
  const raw = localStorage.getItem(ENROLLMENTS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getStoredStudentProgress() {
  const raw = localStorage.getItem(STUDENT_PROGRESS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getCourseItemCount(course) {
  return (course.modules || []).reduce(
    (sum, module) => sum + ((module.items || []).length || 0),
    0,
  );
}

export default function AdminReportsPanel() {
  const users = getStoredUsers();
  const courses = getStoredCourses();
  const enrollments = getStoredEnrollments();
  const studentProgress = getStoredStudentProgress();

  const ownerNameByEmail = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      map.set((user.email || '').toLowerCase(), user.name || user.email || 'Unknown');
    });
    return map;
  }, [users]);

  const reportRows = useMemo(() => {
    return courses.map((course) => {
      const courseId = course.id;
      const totalItems = getCourseItemCount(course);

      const enrolledStudentEmails = Object.entries(enrollments)
        .filter(([, ids]) => Array.isArray(ids) && ids.includes(courseId))
        .map(([email]) => email.toLowerCase());

      const enrolledCount = enrolledStudentEmails.length;

      let averageCompletion = 0;
      if (enrolledCount > 0 && totalItems > 0) {
        const completionPercents = enrolledStudentEmails.map((studentEmail) => {
          const completedMap = (studentProgress[studentEmail] || {})[courseId] || {};
          const completedCount = Object.values(completedMap).filter(Boolean).length;
          return Math.round((completedCount / totalItems) * 100);
        });
        const sum = completionPercents.reduce((acc, value) => acc + value, 0);
        averageCompletion = Math.round(sum / completionPercents.length);
      }

      return {
        id: courseId,
        title: course.title || 'Untitled course',
        owner:
          ownerNameByEmail.get((course.ownerEmail || '').toLowerCase()) ||
          course.instructor ||
          'Unknown',
        enrolledCount,
        averageCompletion,
      };
    });
  }, [courses, enrollments, ownerNameByEmail, studentProgress]);

  return (
    <div className="dashboardPanel">
      <h3>Reports</h3>
      <p>Simple per-course enrollment and completion overview.</p>

      <section className="adminUsersTable adminUsersTableWide">
        <div className="adminUsersTableHeader adminReportsTableHeaderWide">
          <span>Course</span>
          <span>Owner</span>
          <span>Enrolled</span>
          <span>Avg Completion</span>
        </div>

        {reportRows.length ? (
          reportRows.map((row) => (
            <div key={row.id} className="adminUsersTableRow adminReportsTableRowWide">
              <span>{row.title}</span>
              <span>{row.owner}</span>
              <span>{String(row.enrolledCount)}</span>
              <span>{row.averageCompletion}%</span>
            </div>
          ))
        ) : (
          <div className="adminUsersTableRow adminReportsTableRowWide">
            <span>No courses available yet.</span>
            <span>-</span>
            <span>-</span>
            <span>-</span>
          </div>
        )}
      </section>
    </div>
  );
}
