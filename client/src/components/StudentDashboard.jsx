import { useMemo } from 'react';
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
import {
  mean,
  studentAssignmentDueBuckets,
  studentCompletionByCourse,
} from '../utils/dashboardStats';

const COURSES_KEY = 'learnify_courses';
const ENROLLMENTS_KEY = 'learnify_enrollments';
const STUDENT_PROGRESS_KEY = 'learnify_student_progress';

const BAR_FILL = '#2563eb';
const AXIS = '#64748b';
const GRID = '#e2e8f0';

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

function CompletionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="dashboardChartTooltip">
      <strong>{row.fullTitle}</strong>
      <div>Completion: {row.completionPct}%</div>
      <div>
        Items done: {row.completed} of {row.totalItems}
      </div>
    </div>
  );
}

function DueBucketTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="dashboardChartTooltip">
      <strong>{row.label}</strong>
      <div>Assignments: {row.count}</div>
    </div>
  );
}

export default function StudentDashboard() {
  const currentUser = JSON.parse(localStorage.getItem('learnify_current_user') || 'null');
  const studentEmail = (currentUser?.email || '').toLowerCase();
  const enrollments = getStoredEnrollments();
  const enrolledIds = enrollments[studentEmail] || [];
  const allCourses = getStoredCourses();
  const enrolledCourses = allCourses.filter((course) => enrolledIds.includes(course.id));
  const studentProgress = getStoredStudentProgress();

  const assignmentItems = enrolledCourses.flatMap((course) =>
    (course.modules || []).flatMap((module) =>
      (module.items || []).filter((item) => item.type === 'assignment'),
    ),
  );
  const upcomingAssignments = assignmentItems.filter((item) => item.dueAt).length;

  const completionRows = useMemo(
    () => studentCompletionByCourse(studentEmail, allCourses, enrollments, studentProgress),
    [allCourses, enrollments, studentEmail, studentProgress],
  );

  const dueBuckets = useMemo(() => studentAssignmentDueBuckets(assignmentItems), [assignmentItems]);

  const meanCompletion = useMemo(() => {
    const pcts = completionRows.map((r) => r.completionPct);
    return Math.round(mean(pcts) * 10) / 10;
  }, [completionRows]);

  const completionAria = useMemo(() => {
    if (!completionRows.length) return 'No enrolled courses.';
    const bits = completionRows.map((r) => `${r.fullTitle} ${r.completionPct} percent`);
    return `Bar chart of completion rate by course: ${bits.join(', ')}.`;
  }, [completionRows]);

  const dueAria = useMemo(() => {
    const bits = dueBuckets.map((b) => `${b.label} ${b.count}`);
    return `Bar chart of assignments by due-date window: ${bits.join(', ')}.`;
  }, [dueBuckets]);

  return (
    <SectionContainer
      title="Student Dashboard"
      subtitle="Summary view using your saved learning data."
    >
      <div className="dashboardQuickGrid">
        <Card
          title="Enrolled Courses"
          value={String(enrolledCourses.length)}
          description={
            enrolledCourses.length
              ? 'Courses you can access right now.'
              : 'No enrolled courses yet. Use Browse to join one.'
          }
        />
        <Card
          title="Mean completion (your courses)"
          value={enrolledCourses.length ? `${meanCompletion}%` : '—'}
          description={
            enrolledCourses.length
              ? 'Average of observed completion rates across your enrollments.'
              : 'Progress will appear after enrollment.'
          }
        />
        <Card
          title="Upcoming Assignments"
          value={String(upcomingAssignments)}
          description={
            upcomingAssignments
              ? 'Assignments with a due date set.'
              : 'No assignment due dates available yet.'
          }
        />
      </div>

      <div className="dashboardChartGrid">
        <DashboardChartCard
          title="Completion rate by course"
          caption="Ratio of completed learning items to all items in each course (empirical progress)."
          footnote={
            completionRows.length
              ? `Across ${completionRows.length} course(s), your mean completion is about ${meanCompletion}%.`
              : 'Enroll in a course to track completion here.'
          }
          ariaLabel={completionAria}
        >
          {!completionRows.length ? (
            <p className="dashboardChartEmpty">Enroll in courses to see how far you have moved through each one.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionRows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  interval={0}
                  angle={-16}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  unit="%"
                />
                <Tooltip content={<CompletionTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
                <Bar dataKey="completionPct" fill={BAR_FILL} radius={[6, 6, 0, 0]} maxBarSize={44} name="Completion %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title="Assignments by due-date window"
          caption="Ordinal buckets from today: helps you see urgency at a glance (counts, not dates)."
          footnote={`Total assignments in your enrolled courses: ${assignmentItems.length}.`}
          ariaLabel={dueAria}
        >
          {!assignmentItems.length ? (
            <p className="dashboardChartEmpty">No assignments found in your courses yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dueBuckets} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<DueBucketTooltip />} cursor={{ fill: 'rgba(13, 148, 136, 0.06)' }} />
                <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={48} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>
      </div>

      <div className="dashboardAnnouncements">
        <h4>Learning Updates</h4>
        <ul>
          {enrolledCourses.length ? (
            <>
              <li>You are enrolled in {enrolledCourses.length} course(s).</li>
              <li>Open My Courses to view modules and materials set by instructors.</li>
              <li>Charts above summarize measurable progress and upcoming due dates.</li>
            </>
          ) : (
            <>
              <li>No enrolled courses yet.</li>
              <li>Use My Courses and switch to Browse to explore available courses.</li>
              <li>After enrollment, your personalized updates will appear here.</li>
            </>
          )}
        </ul>
      </div>
    </SectionContainer>
  );
}
