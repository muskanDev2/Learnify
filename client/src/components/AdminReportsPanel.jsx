import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DashboardChartCard from './DashboardChartCard';
import ReportFiltersBar from './ReportFiltersBar';
import { fetchAdminReports } from '../utils/adminStatsApi';
import { DEFAULT_ADMIN_REPORT_FILTER } from '../utils/reportFilters';

const BAR_ENROLL = '#2563eb';
const AXIS = '#64748b';
const GRID = '#e2e8f0';

function EnrollmentChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="dashboardChartTooltip">
      <strong>{row.fullTitle}</strong>
      <div>Enrollments: {row.enrollments}</div>
      <div>Avg completion: {row.averageCompletion}%</div>
    </div>
  );
}

export default function AdminReportsPanel() {
  const [filter, setFilter] = useState(DEFAULT_ADMIN_REPORT_FILTER);
  const [reportData, setReportData] = useState(null);
  const [courseOptions, setCourseOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadReports = useCallback(async (nextFilter) => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fetchAdminReports(nextFilter);
      setReportData(data);
      if (Array.isArray(data?.courseOptions)) {
        setCourseOptions(data.courseOptions);
      }
    } catch (error) {
      setReportData(null);
      setLoadError(error.message || 'Could not load reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports(filter);
  }, [filter, loadReports]);

  const summary = reportData?.summary;
  const courseRows = reportData?.courses || [];
  const hasActivity = courseRows.some((row) => row.enrolledCount > 0 || row.averageCompletion > 0);

  const chartData = useMemo(
    () =>
      courseRows
        .filter((row) => row.enrolledCount > 0 || filter.courseId !== 'all')
        .map((row) => ({
          id: row.id,
          label: row.title.length > 18 ? `${row.title.slice(0, 16)}…` : row.title,
          fullTitle: row.title,
          enrollments: row.enrolledCount,
          averageCompletion: row.averageCompletion,
        }))
        .slice(0, filter.courseId !== 'all' ? 1 : 10),
    [courseRows, filter.courseId],
  );

  const filterSummary = reportData
    ? `${reportData.courseLabel || 'All Courses'} · ${reportData.periodLabel || 'All time'}`
    : '';

  return (
    <div className="dashboardPanel">
      <h3>Reports</h3>
      <p>Enrollment and completion overview filtered by course and time.</p>

      <ReportFiltersBar
        courses={courseOptions}
        value={filter}
        onChange={setFilter}
        disabled={isLoading}
      />

      {filterSummary && <p className="authSubtext reportPeriodLabel">Showing: {filterSummary}</p>}

      {loadError && <p className="errorText formError">{loadError}</p>}

      {isLoading ? (
        <div className="dashboardFeedback" aria-live="polite">
          Loading reports...
        </div>
      ) : (
        <>
          {summary && (
            <div className="dashboardQuickGrid">
              <article className="dashboardStatCard">
                <h4>Total Enrollments</h4>
                <p>{summary.totalEnrollments}</p>
              </article>
              <article className="dashboardStatCard">
                <h4>Average Progress</h4>
                <p>{summary.averageProgressPercent}%</p>
              </article>
              <article className="dashboardStatCard">
                <h4>Completed Courses</h4>
                <p>{summary.completedCourses}</p>
              </article>
            </div>
          )}

          <div className="dashboardChartGrid reportChartGrid">
            <DashboardChartCard
              title="Enrollments in selected period"
              footnote={chartData.length ? `${chartData.length} course(s) shown` : 'No data for this filter.'}
              ariaLabel="Bar chart of enrollments by course for the selected filters"
            >
              {chartData.length === 0 ? (
                <p className="dashboardChartEmpty">No enrollment data for the selected course and time.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout={chartData.length === 1 ? 'horizontal' : 'vertical'}
                    margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke={GRID} horizontal={chartData.length === 1} vertical={chartData.length !== 1} />
                    {chartData.length === 1 ? (
                      <>
                        <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} />
                        <YAxis type="category" dataKey="label" width={120} tick={{ fill: AXIS, fontSize: 11 }} />
                      </>
                    ) : (
                      <>
                        <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={100}
                          tick={{ fill: AXIS, fontSize: 11 }}
                        />
                      </>
                    )}
                    <Tooltip content={<EnrollmentChartTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
                    <Bar dataKey="enrollments" fill={BAR_ENROLL} radius={[0, 6, 6, 0]} maxBarSize={32} name="Enrollments" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </DashboardChartCard>
          </div>

          <section className="adminUsersTable adminUsersTableWide">
            <div className="adminUsersTableHeader adminReportsTableHeaderWide">
              <span>Course</span>
              <span>Owner</span>
              <span>Enrolled</span>
              <span>Avg Completion</span>
            </div>

            {!courseRows.length ? (
              <div className="adminUsersTableRow adminReportsTableRowWide">
                <span>No courses available yet.</span>
                <span>-</span>
                <span>-</span>
                <span>-</span>
              </div>
            ) : !hasActivity && (filter.period !== 'all_time' || filter.courseId !== 'all') ? (
              <div className="adminUsersTableRow adminReportsTableRowWide reportEmptyStateRow">
                <span>No enrollment or progress activity found for these filters.</span>
                <span>-</span>
                <span>-</span>
                <span>-</span>
              </div>
            ) : (
              courseRows.map((row) => (
                <div key={row.id} className="adminUsersTableRow adminReportsTableRowWide">
                  <span>{row.title}</span>
                  <span>{row.owner}</span>
                  <span>{String(row.enrolledCount)}</span>
                  <span>{row.averageCompletion}%</span>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
