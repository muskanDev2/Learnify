import { useEffect, useMemo, useState } from 'react';
import { fetchCourses } from '../utils/courseApi';
import { fetchEnrollments } from '../utils/enrollmentApi';
import { fetchProgress } from '../utils/progressApi';
import { fetchUsers } from '../utils/userApi';
import { fetchAdminProgressStats } from '../utils/adminStatsApi';

function getCourseItemCount(course) {
  return (course.modules || []).reduce(
    (sum, module) => sum + ((module.items || []).length || 0),
    0,
  );
}

export default function AdminReportsPanel() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [studentProgress, setStudentProgress] = useState({});
  const [progressStats, setProgressStats] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchUsers(),
      fetchCourses(),
      fetchEnrollments(),
      fetchProgress(),
      fetchAdminProgressStats(),
    ])
      .then(([apiUsers, apiCourses, apiEnrollments, apiProgress, apiProgressStats]) => {
        setUsers(apiUsers);
        setCourses(apiCourses);
        setEnrollments(apiEnrollments);
        setStudentProgress(apiProgress);
        setProgressStats(apiProgressStats);
      })
      .catch(() => {});
  }, []);

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

      {progressStats && (
        <div className="dashboardQuickGrid">
          <article className="dashboardStatCard">
            <h4>Total Enrollments</h4>
            <p>{progressStats.totalEnrollments}</p>
          </article>
          <article className="dashboardStatCard">
            <h4>Average Progress</h4>
            <p>{progressStats.averageProgressPercent}%</p>
          </article>
          <article className="dashboardStatCard">
            <h4>Completed Courses</h4>
            <p>{progressStats.completedCourses}</p>
          </article>
        </div>
      )}

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
