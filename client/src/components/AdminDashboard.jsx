import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from './Card';
import DashboardChartCard from './DashboardChartCard';
import SectionContainer from './SectionContainer';
import { adminEnrollmentByCourse, adminRoleFrequencies } from '../utils/dashboardStats';
import { isInstructor, isStudent } from '../utils/authUtils';
import { fetchCourses } from '../utils/courseApi';
import { fetchEnrollments } from '../utils/enrollmentApi';
import { fetchUsers } from '../utils/userApi';
import { fetchAdminUserStats } from '../utils/adminStatsApi';

const BAR_PRIMARY = '#2563eb';
const AXIS = '#64748b';
const GRID = '#e2e8f0';

function RoleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="dashboardChartTooltip">
      <strong>{row.label}</strong>
      <div>Count: {row.count}</div>
      <div>Share of all accounts: {row.pct}%</div>
    </div>
  );
}

function EnrollmentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="dashboardChartTooltip">
      <strong>{row.fullTitle}</strong>
      <div>Enrolled learners: {row.enrollments}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchCourses(), fetchEnrollments(), fetchAdminUserStats()])
      .then(([apiUsers, apiCourses, apiEnrollments, apiUserStats]) => {
        setUsers(apiUsers);
        setCourses(apiCourses);
        setEnrollments(apiEnrollments);
        setUserStats(apiUserStats);
      })
      .catch(() => {});
  }, []);
  const totalStudents = users.filter((user) => isStudent(user)).length;
  const totalInstructors = users.filter((user) => isInstructor(user)).length;

  const roleData = useMemo(() => adminRoleFrequencies(users), [users]);
  const enrollmentStats = useMemo(
    () => adminEnrollmentByCourse(courses, enrollments),
    [courses, enrollments],
  );

  const roleAria = useMemo(() => {
    if (!users.length) return 'No user accounts to chart.';
    const parts = roleData.map((r) => `${r.label} ${r.count}`);
    return `Bar chart of account counts by role: ${parts.join(', ')}.`;
  }, [roleData, users.length]);

  const enrollAria = useMemo(() => {
    if (!courses.length) return 'No courses to chart.';
    const top = enrollmentStats.rows
      .filter((r) => r.enrollments > 0)
      .slice(0, 5)
      .map((r) => `${r.fullTitle} ${r.enrollments}`);
    const summary = top.length ? top.join('; ') : 'all courses currently at zero enrollments';
    return `Bar chart of learner enrollments per course. Examples: ${summary}.`;
  }, [courses.length, enrollmentStats.rows]);

  return (
    <SectionContainer
      title="Admin Dashboard"
      subtitle="Summary view using current platform data."
    >
      <div className="dashboardQuickGrid">
        <Card
          title="Total Students"
          value={String(userStats?.students ?? totalStudents)}
          description={totalStudents ? 'Registered student accounts.' : 'No student accounts yet.'}
        />
        <Card
          title="Total Instructors"
          value={String(userStats?.instructors ?? totalInstructors)}
          description={totalInstructors ? 'Registered instructor accounts.' : 'No instructor accounts yet.'}
        />
        <Card
          title="Total Users"
          value={String(userStats?.totalUsers ?? users.length)}
          description={users.length ? 'Registered users in system.' : 'No registered users yet.'}
        />
        <Card
          title="Total Courses"
          value={String(courses.length)}
          description={courses.length ? 'Courses currently available.' : 'No courses available yet.'}
        />
      </div>

      <div className="dashboardChartGrid">
        <DashboardChartCard
          title="Account types (frequency)"
          caption="Categorical counts: each user is placed in exactly one role (admin, instructor, or student)."
          footnote={users.length ? `n = ${users.length} accounts` : 'No accounts yet.'}
          ariaLabel={roleAria}
        >
          {users.length === 0 ? (
            <p className="dashboardChartEmpty">Add users to see how account types are distributed.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<RoleTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
                <Bar
                  dataKey="count"
                  fill={BAR_PRIMARY}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={52}
                  name="Accounts"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title="Enrollment by course (top ten)"
          caption={`Across all courses, mean enrollments ≈ ${enrollmentStats.meanEnrollments}, median ≈ ${enrollmentStats.medianEnrollments}.`}
          footnote={`Ranked by enrollment; ${enrollmentStats.courseCount} course(s) in catalog.`}
          ariaLabel={enrollAria}
        >
          {courses.length === 0 ? (
            <p className="dashboardChartEmpty">Create courses to compare how many learners joined each one.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={enrollmentStats.rows}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<EnrollmentTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }} />
                <Bar
                  dataKey="enrollments"
                  fill="#0d9488"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={28}
                  name="Enrollments"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>
      </div>
    </SectionContainer>
  );
}
