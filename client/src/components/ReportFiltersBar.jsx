import ReportTimeFilter from './ReportTimeFilter';
import { mergeReportFilter } from '../utils/reportFilters';

/**
 * Combined report filters (course + time). Add more controls here later (instructor, category, …).
 */
export default function ReportFiltersBar({ courses = [], value, onChange, disabled = false }) {
  function handleCourseChange(event) {
    const courseId = event.target.value;
    onChange(mergeReportFilter(value, { courseId: courseId === 'all' ? 'all' : Number(courseId) }));
  }

  function handleTimeChange(timePartial) {
    onChange(mergeReportFilter(value, timePartial));
  }

  return (
    <div className="reportFiltersBar">
      <div className="reportFilterGroup">
        <label htmlFor="report-course-filter">Course</label>
        <select
          id="report-course-filter"
          value={value.courseId === 'all' || value.courseId == null ? 'all' : String(value.courseId)}
          onChange={handleCourseChange}
          disabled={disabled}
        >
          <option value="all">All Courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title || `Course ${course.id}`}
            </option>
          ))}
        </select>
      </div>

      <ReportTimeFilter value={value} onChange={handleTimeChange} disabled={disabled} />
    </div>
  );
}
