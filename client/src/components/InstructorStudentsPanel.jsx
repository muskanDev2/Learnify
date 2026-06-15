import { useEffect, useMemo, useState } from 'react';
import Card from './Card';
import SectionContainer from './SectionContainer';
import Toast from './Toast';
import { getCurrentUser } from '../utils/authUtils';
import { fetchCourses } from '../utils/courseApi';
import { fetchEnrollments } from '../utils/enrollmentApi';
import { fetchProgress } from '../utils/progressApi';
import { fetchStudents } from '../utils/userApi';
import { approveCertificate, fetchInstructorCertificateOverview } from '../utils/certificateApi';
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

function getProgramSemesterLabel(student) {
  const program = student.degreeProgram || 'Program not provided';
  const semester = student.semester ? `Semester ${student.semester}` : 'Semester not selected';
  return `${program} - ${semester}`;
}

function overviewKey(courseId, email) {
  return `${courseId}:${String(email).toLowerCase()}`;
}

export default function InstructorStudentsPanel() {
  const currentUser = getCurrentUser();
  const instructorEmail = String(currentUser?.email || '').toLowerCase();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [students, setStudents] = useState([]);
  const [progress, setProgress] = useState({});
  const [certificateRows, setCertificateRows] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [completionThreshold, setCompletionThreshold] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingApproval, setPendingApproval] = useState(null);
  const [processingKey, setProcessingKey] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  useEffect(() => {
    let isMounted = true;

    async function loadStudentsPanel() {
      setStatus('loading');
      setErrorMessage('');

      try {
        const [apiCourses, apiEnrollments, apiStudents, apiProgress, apiCertificates] = await Promise.all([
          fetchCourses(),
          fetchEnrollments(),
          fetchStudents(),
          fetchProgress(),
          fetchInstructorCertificateOverview().catch(() => []),
        ]);

        if (!isMounted) return;

        setCourses(apiCourses);
        setEnrollments(apiEnrollments);
        setStudents(apiStudents);
        setProgress(apiProgress);
        setCertificateRows(apiCertificates);
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

  useEffect(() => {
    if (!toast.message) return undefined;
    const timer = setTimeout(() => setToast({ message: '', type: 'success' }), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const certificateLookup = useMemo(() => {
    const map = new Map();
    certificateRows.forEach((row) => {
      map.set(overviewKey(row.courseId, row.studentEmail), row);
    });
    return map;
  }, [certificateRows]);

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

  function getCourseCertificateInfo(student, course) {
    const email = String(student.email || '').toLowerCase();
    const row = certificateLookup.get(overviewKey(course.id, email));
    const progressPercent = row
      ? row.progressPercent
      : getCourseItemCount(course)
        ? Math.round((getCompletedItemCount(progress, email, course.id) / getCourseItemCount(course)) * 100)
        : 0;

    return {
      progressPercent,
      meetsThreshold: progressPercent >= completionThreshold,
      isFullyComplete: progressPercent >= 100,
      certificateApproved: Boolean(row?.certificateApproved),
      certificateUrl: row?.certificateUrl || '',
    };
  }

  async function confirmApproval() {
    if (!pendingApproval) return;
    const { courseId, studentEmail, progressPercent } = pendingApproval;
    const key = overviewKey(courseId, studentEmail);
    const override = progressPercent < 100;
    setProcessingKey(key);

    try {
      await approveCertificate({ courseId, studentEmail, override });
      const refreshed = await fetchInstructorCertificateOverview().catch(() => null);
      if (refreshed) setCertificateRows(refreshed);
      setToast({ message: 'Certificate approved successfully.', type: 'success' });
      setPendingApproval(null);
    } catch (error) {
      setToast({ message: error.message || 'Could not approve certificate.', type: 'error' });
    } finally {
      setProcessingKey('');
    }
  }

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
            <label>
              <span>Completion threshold (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={completionThreshold}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isNaN(next)) return;
                  setCompletionThreshold(Math.min(100, Math.max(0, next)));
                }}
                title="Progress at which a student counts as Completed. You can still approve below it."
              />
            </label>
          </div>

          <div className="instructorStudentsList" aria-live="polite">
            {studentRows.length ? (
              studentRows.map((student) => {
                const visibleCourses =
                  selectedCourseId === 'all'
                    ? student.courses
                    : student.courses.filter((course) => String(course.id) === selectedCourseId);

                return (
                  <article key={student.email} className="instructorStudentCard">
                    <div className="instructorStudentAvatar" aria-hidden="true">
                      {(student.name || student.email || 'S').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="instructorStudentMain">
                      <div className="instructorStudentHeader">
                        <div>
                          <h4>{student.name || 'Unnamed student'}</h4>
                          <p>{student.email}</p>
                          <p>{getProgramSemesterLabel(student)}</p>
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

                      <div className="certificateTable" role="table" aria-label={`Certificates for ${student.name}`}>
                        <div className="certificateTableHead" role="row">
                          <span role="columnheader">Course</span>
                          <span role="columnheader">Progress</span>
                          <span role="columnheader">Status</span>
                          <span role="columnheader">Certificate</span>
                        </div>
                        {visibleCourses.map((course) => {
                          const info = getCourseCertificateInfo(student, course);
                          const key = overviewKey(course.id, student.email);
                          const isProcessing = processingKey === key;

                          return (
                            <div className="certificateTableRow" role="row" key={`${student.email}-${course.id}`}>
                              <span className="certificateCourseName" role="cell">
                                {course.title}
                              </span>
                              <span role="cell">{info.progressPercent}%</span>
                              <span role="cell">
                                <span
                                  className={`statusChip ${info.meetsThreshold ? 'statusChipCompleted' : 'statusChipProgress'}`}
                                >
                                  {info.meetsThreshold ? 'Completed' : 'In progress'}
                                </span>
                              </span>
                              <span className="certificateActionCell" role="cell">
                                {info.certificateApproved ? (
                                  <span className="certificateApprovedGroup">
                                    <span className="statusChip statusChipApproved">Approved</span>
                                    {info.certificateUrl && (
                                      <a
                                        className="certificateLinkButton"
                                        href={info.certificateUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        View
                                      </a>
                                    )}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className={`certificateApproveButton ${info.meetsThreshold ? '' : 'certificateApproveButtonOverride'}`}
                                    disabled={isProcessing}
                                    title={
                                      info.meetsThreshold
                                        ? 'Approve certificate for this student'
                                        : `Student is at ${info.progressPercent}% (below the ${completionThreshold}% threshold). You can still approve.`
                                    }
                                    aria-label={`Approve certificate for ${student.name} in ${course.title}`}
                                    onClick={() =>
                                      setPendingApproval({
                                        courseId: course.id,
                                        studentEmail: String(student.email).toLowerCase(),
                                        studentName: student.name || student.email,
                                        courseTitle: course.title,
                                        progressPercent: info.progressPercent,
                                      })
                                    }
                                  >
                                    {isProcessing ? 'Approving...' : info.meetsThreshold ? 'Approve' : 'Approve early'}
                                  </button>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })
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

      {pendingApproval && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true" aria-labelledby="approve-cert-title">
          <div className="lightboxCard">
            <h3 id="approve-cert-title">
              {pendingApproval.progressPercent < 100 ? 'Approve certificate early?' : 'Approve certificate'}
            </h3>
            <p className="authSubtext">
              Issue the completion certificate for <strong>{pendingApproval.studentName}</strong> in{' '}
              <strong>{pendingApproval.courseTitle}</strong>? The student will be able to download it immediately.
            </p>
            {pendingApproval.progressPercent < 100 && (
              <p className="certificateOverrideWarning" role="alert">
                Heads up: this student has only completed <strong>{pendingApproval.progressPercent}%</strong> of the
                course (below 100%). Approving will issue the certificate anyway.
              </p>
            )}
            <div className="profileModalActions">
              <button
                type="button"
                className="profilePrimaryButton"
                onClick={confirmApproval}
                disabled={Boolean(processingKey)}
              >
                {processingKey ? 'Approving...' : 'Yes, approve'}
              </button>
              <button
                type="button"
                className="heroButton heroButtonSecondary"
                onClick={() => setPendingApproval(null)}
                disabled={Boolean(processingKey)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} />
    </SectionContainer>
  );
}
