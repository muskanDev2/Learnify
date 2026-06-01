import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from './Card';
import DashboardChartCard from './DashboardChartCard';
import SectionContainer from './SectionContainer';
import { instructorCourseLoadSeries, mean, median } from '../utils/dashboardStats';
import { getCurrentUser } from '../utils/authUtils';
import { fetchCourses } from '../utils/courseApi';
import { fetchEnrollments } from '../utils/enrollmentApi';

const AXIS = '#64748b';
const GRID = '#e2e8f0';

function LoadTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="dashboardChartTooltip">
      <strong>{row.fullTitle}</strong>
      <div>Learners enrolled: {row.students}</div>
      <div>Assignments in course: {row.assignments}</div>
    </div>
  );
}

export default function InstructorDashboard() {
  const currentUser = getCurrentUser();
  const instructorEmail = (currentUser?.email || '').toLowerCase();
  const [allCourses, setAllCourses] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const courses = allCourses.filter((course) => course.ownerEmail === instructorEmail);

  useEffect(() => {
    Promise.all([fetchCourses(), fetchEnrollments()])
      .then(([apiCourses, apiEnrollments]) => {
        setAllCourses(apiCourses);
        setEnrollments(apiEnrollments);
      })
      .catch(() => {});
  }, []);
  const totalStudents = Object.values(enrollments).reduce((sum, ids) => {
    if (!Array.isArray(ids)) return sum;
    return sum + ids.filter((id) => courses.some((course) => course.id === id)).length;
  }, 0);
  const pendingToGrade = courses
    .flatMap((course) => (course.modules || []).flatMap((module) => module.items || []))
    .filter((item) => item.type === 'assignment').length;

  const loadSeries = useMemo(
    () => instructorCourseLoadSeries(allCourses, enrollments, instructorEmail),
    [allCourses, enrollments, instructorEmail],
  );

  const studentCounts = loadSeries.map((r) => r.students);
  const assignCounts = loadSeries.map((r) => r.assignments);
  const meanStudents = Math.round(mean(studentCounts) * 10) / 10;
  const medianStudents = Math.round(median(studentCounts) * 10) / 10;
  const meanAssign = Math.round(mean(assignCounts) * 10) / 10;

  const loadAria = useMemo(() => {
    if (!loadSeries.length) return 'No courses to chart.';
    const bits = loadSeries.map((r) => `${r.fullTitle}: ${r.students} learners, ${r.assignments} assignments`);
    return `Grouped bar chart per course: ${bits.join('; ')}.`;
  }, [loadSeries]);

  return (
    <SectionContainer
      title="Instructor Dashboard"
      subtitle="Summary view using your real saved course data."
    >
      <div className="dashboardQuickGrid">
        <Card
          title="My Courses"
          value={String(courses.length)}
          description={courses.length ? 'Courses created by you.' : 'No courses created yet.'}
        />
        <Card
          title="Total Students"
          value={String(totalStudents)}
          description={totalStudents ? 'Students enrolled in your courses.' : 'No enrolled students yet.'}
        />
        <Card
          title="Pending Assignments to Grade"
          value={String(pendingToGrade)}
          description={pendingToGrade ? 'Assignments available for manual grading.' : 'No assignments to grade yet.'}
        />
      </div>

      <div className="dashboardChartGrid">
        <DashboardChartCard
          title="Teaching load by course"
          caption="Side-by-side magnitudes: enrolled learners and assignment items you created in each course."
          footnote={
            loadSeries.length
              ? `Typical class size (median learners): ${medianStudents}; mean learners ≈ ${meanStudents}; mean assignments ≈ ${meanAssign}.`
              : 'Create a course to see this comparison.'
          }
          ariaLabel={loadAria}
        >
          {!loadSeries.length ? (
            <p className="dashboardChartEmpty">Your courses will appear here as grouped bars for quick workload comparison.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loadSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<LoadTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
                <Legend
                  wrapperStyle={{ fontSize: '0.82rem', paddingTop: 8 }}
                  formatter={(value) => (value === 'students' ? 'Learners enrolled' : 'Assignments')}
                />
                <Bar dataKey="students" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={36} name="students" />
                <Bar dataKey="assignments" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={36} name="assignments" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>
      </div>
    </SectionContainer>
  );
}
