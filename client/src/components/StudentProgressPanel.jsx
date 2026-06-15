import { useEffect, useMemo, useState } from 'react';
import Card from './Card';
import SectionContainer from './SectionContainer';
import { getCurrentUser } from '../utils/authUtils';
import { fetchCourses } from '../utils/courseApi';
import { fetchEnrollments } from '../utils/enrollmentApi';
import { fetchProgress } from '../utils/progressApi';
import { fetchMyCertificates } from '../utils/certificateApi';
import { getCourseItemCount, studentCompletionByCourse } from '../utils/dashboardStats';

function getCourseItems(course) {
  return (course.modules || []).flatMap((module) =>
    (module.items || []).map((item) => ({
      ...item,
      moduleTitle: module.title || 'Untitled module',
    })),
  );
}

function formatLastActivity(progressMap, courseId) {
  const courseProgress = progressMap?.[courseId] || {};
  const completedCount = Object.values(courseProgress).filter(Boolean).length;
  return completedCount ? `${completedCount} item(s) completed` : 'No completed items yet';
}

export default function StudentProgressPanel() {
  const currentUser = getCurrentUser();
  const studentEmail = (currentUser?.email || '').toLowerCase();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [progress, setProgress] = useState({});
  const [certificates, setCertificates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadProgressData() {
      setStatus('loading');
      setErrorMessage('');

      try {
        const [apiCourses, apiEnrollments, apiProgress, apiCertificates] = await Promise.all([
          fetchCourses(),
          fetchEnrollments(),
          fetchProgress(),
          fetchMyCertificates().catch(() => []),
        ]);

        if (!isMounted) return;

        setCourses(apiCourses);
        setEnrollments(apiEnrollments);
        setProgress(apiProgress);
        setCertificates(apiCertificates);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error.message || 'Could not load progress right now.');
        setStatus('error');
      }
    }

    loadProgressData();

    return () => {
      isMounted = false;
    };
  }, []);

  const enrolledIds = useMemo(() => enrollments[studentEmail] || [], [enrollments, studentEmail]);
  const enrolledCourses = useMemo(
    () => courses.filter((course) => enrolledIds.includes(course.id)),
    [courses, enrolledIds],
  );
  const completionRows = useMemo(
    () => studentCompletionByCourse(studentEmail, courses, enrollments, progress),
    [courses, enrollments, progress, studentEmail],
  );
  const certificateByCourseId = useMemo(() => {
    const map = {};
    certificates.forEach((certificate) => {
      if (certificate.certificateApproved) map[certificate.courseId] = certificate;
    });
    return map;
  }, [certificates]);
  const progressByCourseId = progress[studentEmail] || {};
  const totalItems = enrolledCourses.reduce((sum, course) => sum + getCourseItemCount(course), 0);
  const completedItems = completionRows.reduce((sum, row) => sum + row.completed, 0);
  const overallProgress = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
  const pendingItems = Math.max(0, totalItems - completedItems);

  return (
    <SectionContainer
      title="My Progress"
      subtitle="Track your course completion using your saved learning activity."
    >
      {status === 'loading' ? (
        <div className="dashboardFeedback" aria-live="polite">
          Loading your progress...
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
              title="Overall Progress"
              value={enrolledCourses.length ? `${overallProgress}%` : '0%'}
              description="Completed learning items across enrolled courses."
            />
            <Card
              title="Completed Items"
              value={`${completedItems}/${totalItems}`}
              description={totalItems ? 'Lectures, assignments, quizzes, and content items.' : 'No course items yet.'}
            />
            <Card
              title="Active Courses"
              value={String(enrolledCourses.length)}
              description={enrolledCourses.length ? 'Courses currently available to you.' : 'Enroll to start tracking.'}
            />
          </div>

          <div className="studentProgressSummary">
            <div className="studentProgressMeter" aria-label={`Overall progress ${overallProgress} percent`}>
              <span style={{ width: `${overallProgress}%` }} />
            </div>
            <div className="studentProgressSummaryMeta">
              <strong>{pendingItems} item(s) remaining</strong>
              <span>{completedItems} completed</span>
            </div>
          </div>

          <div className="studentProgressCourseList">
            {enrolledCourses.length ? (
              enrolledCourses.map((course) => {
                const courseItems = getCourseItems(course);
                const courseProgress = progressByCourseId[course.id] || {};
                const completedCount = courseItems.filter((item) => courseProgress[item.id]).length;
                const pct = courseItems.length ? Math.round((completedCount / courseItems.length) * 100) : 0;
                const certificate = certificateByCourseId[course.id];

                return (
                  <article key={course.id} className="studentProgressCourseCard">
                    <div className="studentProgressCourseHeader">
                      <div>
                        <h4>{course.title}</h4>
                        <p>{course.subtitle || course.category || 'Course progress'}</p>
                      </div>
                      <strong>{pct}%</strong>
                    </div>
                    <div className="studentProgressMeter" aria-label={`${course.title} progress ${pct} percent`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <div className="studentProgressCourseMeta">
                      <span>{formatLastActivity(progressByCourseId, course.id)}</span>
                      <span>
                        {completedCount} of {courseItems.length} item(s)
                      </span>
                    </div>
                    <ul className="studentProgressItemList">
                      {courseItems.slice(0, 5).map((item) => (
                        <li key={`${course.id}-${item.id}`}>
                          <span>
                            {item.title || 'Untitled item'}
                            <small>{item.moduleTitle}</small>
                          </span>
                          <strong>{courseProgress[item.id] ? 'Done' : 'Pending'}</strong>
                        </li>
                      ))}
                    </ul>
                    {certificate ? (
                      <div className="studentCertificateRow studentCertificateRowReady">
                        <span>Certificate available</span>
                        <a
                          className="certificateDownloadButton"
                          href={certificate.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          Download Certificate
                        </a>
                      </div>
                    ) : pct >= 100 ? (
                      <div className="studentCertificateRow studentCertificateRowPending">
                        <span>Course complete — awaiting instructor approval for your certificate.</span>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="dashboardAnnouncements">
                <h4>No progress yet</h4>
                <ul>
                  <li>Enroll in a course from My Courses to start tracking progress.</li>
                  <li>Open course content, submit assignments, or complete quizzes to update this page.</li>
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </SectionContainer>
  );
}
