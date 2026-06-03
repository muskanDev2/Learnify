import { useEffect, useMemo, useState } from 'react';
import Card from './Card';
import SectionContainer from './SectionContainer';
import { getCurrentUser } from '../utils/authUtils';
import { fetchCourses } from '../utils/courseApi';
import { fetchEnrollments } from '../utils/enrollmentApi';
import { fetchProgress } from '../utils/progressApi';
import { fetchStudents } from '../utils/userApi';
import { getCourseItemCount } from '../utils/dashboardStats';

function getCompletedItemCount(progressMap, email, courseId) {
  const courseProgress = progressMap[String(email).toLowerCase()]?.[courseId] || {};
  return Object.values(courseProgress).filter(Boolean).length;
}

function getStudentCourseStats(student, instructorCourses, enrollments, progressMap) {
  const email = String(student.email || '').toLowerCase();
  const enrolledIds = enrollments[email] || [];
  const courses = instructorCourses.filter((course) => enrolledIds.includes(course.id));
  const totalItems = courses.reduce((sum, course) => sum + getCourseItemCount(course), 0);
  const completedItems = courses.reduce(
    (sum, course) => sum + getCompletedItemCount(progressMap, email, course.id),
    0,
  );

  return {
    courses,
    completedItems,
    totalItems,
    progressPercent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0,
  };
}

export default function InstructorStudentsPanel() {
  const currentUser = getCurrentUser();
  const instructorEmail = String(currentUser?.email || '').toLowerCase();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [students, setStudents] = useState([]);
  const [progress, setProgress] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadStudentsPanel() {
      setStatus('loading');
      setErrorMessage('');

      try {
        const [apiCourses, apiEnrollments, apiStudents, apiProgress] = await Promise.all([
          fetchCourses(),
          fetchEnrollments(),
          fetchStudents(),
          fetchProgress(),
        ]);

        if (!isMounted) return;

        setCourses(apiCourses);
        setEnrollments(apiEnrollments);
        setStudents(apiStudents);
        setProgress(apiProgress);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error.message || 'Could not load students right now.');
        setStatus('error');
      }
    }

    loadStudentsPanel();

    return () => {
      isMounted = false;
    };
  }, []);

  const instructorCourses = useMemo(
    () => courses.filter((course) => String(course.ownerEmail || '').toLowerCase() === instructorEmail),
    [courses, instructorEmail],
  );

  const studentRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return students
      .map((student) => {
        const stats = getStudentCourseStats(student, instructorCourses, enrollments, progress);
        return { ...student, ...stats };
      })
      .filter((student) => student.courses.length > 0)
      .filter((student) =>
        selectedCourseId === 'all'
          ? true
          : student.courses.some((course) => String(course.id) === selectedCourseId),
      )
      .filter((student) => {
        if (!normalizedSearch) return true;
        return [student.name, student.email]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enrollments, instructorCourses, progress, searchTerm, selectedCourseId, students]);

  const uniqueStudentCount = useMemo(() => {
    const emails = new Set();
    students.forEach((student) => {
      const stats = getStudentCourseStats(student, instructorCourses, enrollments, progress);
      if (stats.courses.length) emails.add(String(student.email || '').toLowerCase());
    });
    return emails.size;
  }, [enrollments, instructorCourses, progress, students]);

  const totalEnrollments = studentRows.reduce((sum, student) => sum + student.courses.length, 0);
  const meanProgress = studentRows.length
    ? Math.round(studentRows.reduce((sum, student) => sum + student.progressPercent, 0) / studentRows.length)
    : 0;

  return (
    <SectionContainer
      title="Students"
      subtitle="A focused view of learners enrolled in your courses."
    >
      {status === 'loading' ? (
        <div className="dashboardFeedback" aria-live="polite">
          Loading students...
        </div>
      ) : (
        <>
          {status === 'error' && (
            <div className="dashboardFeedback" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="dashboardQuickGrid">
            <Card
              title="Learners"
              value={String(uniqueStudentCount)}
              description="Unique students enrolled in your courses."
            />
            <Card
              title="Course Enrollments"
              value={String(totalEnrollments)}
              description="Total learner-course relationships in this view."
            />
            <Card
              title="Mean Progress"
              value={studentRows.length ? `${meanProgress}%` : '0%'}
              description="Average visible progress across listed learners."
            />
          </div>

          <div className="instructorStudentsToolbar">
            <label>
              <span>Search learners</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or email"
              />
            </label>
            <label>
              <span>Filter by course</span>
              <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
                <option value="all">All my courses</option>
                {instructorCourses.map((course) => (
                  <option key={course.id} value={String(course.id)}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="instructorStudentsList" aria-live="polite">
            {studentRows.length ? (
              studentRows.map((student) => (
                <article key={student.email} className="instructorStudentCard">
                  <div className="instructorStudentAvatar" aria-hidden="true">
                    {(student.name || student.email || 'S').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="instructorStudentMain">
                    <div className="instructorStudentHeader">
                      <div>
                        <h4>{student.name || 'Unnamed student'}</h4>
                        <p>{student.email}</p>
                      </div>
                      <strong>{student.progressPercent}%</strong>
                    </div>
                    <div className="studentProgressMeter" aria-label={`${student.name} progress ${student.progressPercent} percent`}>
                      <span style={{ width: `${student.progressPercent}%` }} />
                    </div>
                    <div className="instructorStudentMeta">
                      <span>{student.courses.length} course(s)</span>
                      <span>
                        {student.completedItems} of {student.totalItems} item(s) completed
                      </span>
                    </div>
                    <div className="instructorStudentCourses">
                      {student.courses.map((course) => (
                        <span key={course.id}>{course.title}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="dashboardAnnouncements">
                <h4>No students found</h4>
                <ul>
                  <li>Enroll students from My Courses to see them here.</li>
                  <li>Use the search and course filter to narrow larger classes quickly.</li>
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </SectionContainer>
  );
}
