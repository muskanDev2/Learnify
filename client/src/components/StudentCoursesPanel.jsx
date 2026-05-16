import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/authUtils';

const COURSES_KEY = 'learnify_courses';
const ENROLLMENTS_KEY = 'learnify_enrollments';

function getStoredCourses() {
  const rawCourses = localStorage.getItem(COURSES_KEY);
  if (!rawCourses) return [];

  try {
    const parsed = JSON.parse(rawCourses);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStoredEnrollments() {
  const rawEnrollments = localStorage.getItem(ENROLLMENTS_KEY);
  if (!rawEnrollments) return {};

  try {
    const parsed = JSON.parse(rawEnrollments);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredEnrollments(enrollments) {
  localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(enrollments));
}

/** Same logical course can be saved more than once in localStorage (different ids). Collapse to one row for the UI. */
function courseDisplayKey(course) {
  return [
    (course.ownerEmail || '').toLowerCase(),
    course.title || '',
    course.subtitle || '',
    course.description || '',
    course.category || '',
    String(course.enrollmentKey || ''),
  ].join('|');
}

function dedupeCoursesForStudentView(list, enrolledIdSet = new Set()) {
  if (!Array.isArray(list) || list.length === 0) return [];

  // First: one row per id (defensive)
  const byId = new Map();
  list.forEach((course) => {
    if (!byId.has(course.id)) byId.set(course.id, course);
  });
  const uniqueById = Array.from(byId.values());

  // Second: one card per "same course" fingerprint.
  // If the student is enrolled on any duplicate id, keep THAT row so Open Course still works.
  const groups = new Map();
  uniqueById.forEach((course) => {
    const key = courseDisplayKey(course);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(course);
  });

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    const enrolledPick = group.find((c) => enrolledIdSet.has(c.id));
    if (enrolledPick) return enrolledPick;

    return group.reduce((best, c) => {
      const bid = Number(best.id);
      const cid = Number(c.id);
      if (Number.isFinite(bid) && Number.isFinite(cid)) return bid <= cid ? best : c;
      return best;
    });
  });
}

export default function StudentCoursesPanel() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const studentEmail = (currentUser?.email || '').toLowerCase();
  const [enrollments, setEnrollments] = useState(() => getStoredEnrollments());
  const [activeView, setActiveView] = useState('enrolled'); // enrolled | browse
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCourse, setActiveCourse] = useState(null);
  const [enteredKey, setEnteredKey] = useState('');
  const [keyError, setKeyError] = useState('');

  const enrolledCourseIds = [...new Set(enrollments[studentEmail] || [])];
  const enrolledIdsSet = useMemo(() => new Set(enrolledCourseIds), [enrolledCourseIds]);

  const courses = useMemo(
    () => dedupeCoursesForStudentView(getStoredCourses(), enrolledIdsSet),
    [enrolledIdsSet],
  );

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) =>
        course.title.toLowerCase().includes(searchTerm.trim().toLowerCase()),
      ),
    [courses, searchTerm],
  );
  const enrolledCourses = filteredCourses.filter((course) => enrolledCourseIds.includes(course.id));
  const browseCourses = filteredCourses.filter((course) => !enrolledCourseIds.includes(course.id));

  function completeEnrollment(courseId) {
    const currentEnrolledIds = enrollments[studentEmail] || [];
    if (currentEnrolledIds.includes(courseId)) return;

    const updated = {
      ...enrollments,
      [studentEmail]: [...new Set([...currentEnrolledIds, courseId])],
    };
    setEnrollments(updated);
    saveStoredEnrollments(updated);
  }

  function openCourse(courseId) {
    navigate('/courses', { state: { courseId } });
  }

  function openEnrollFlow(course) {
    if (!course.enrollmentKey) {
      completeEnrollment(course.id);
      return;
    }

    setActiveCourse(course);
    setEnteredKey('');
    setKeyError('');
  }

  function closeKeyModal() {
    setActiveCourse(null);
    setEnteredKey('');
    setKeyError('');
  }

  function confirmProtectedEnrollment() {
    if (!activeCourse) return;

    // Frontend-only demo validation (real app must move this to backend).
    if (enteredKey.trim() !== String(activeCourse.enrollmentKey || '').trim()) {
      setKeyError('Invalid key. Please contact the instructor.');
      return;
    }

    completeEnrollment(activeCourse.id);
    closeKeyModal();
  }

  return (
    <section className="myCoursesSection">
      <div className="myCoursesHeader">
        <div>
          <h2>My courses</h2>
          <h3>Enrolled courses and browse catalog</h3>
        </div>
        <div className="studentCourseViewSwitch">
          <button
            type="button"
            className={activeView === 'enrolled' ? 'dashboardLinkButton' : 'heroButton heroButtonSecondary'}
            onClick={() => setActiveView('enrolled')}
          >
            Enrolled
          </button>
          <button
            type="button"
            className={activeView === 'browse' ? 'dashboardLinkButton' : 'heroButton heroButtonSecondary'}
            onClick={() => setActiveView('browse')}
          >
            Browse
          </button>
        </div>
      </div>

      <div className="myCoursesFilters myCoursesFiltersSearchOnly">
        <input
          type="search"
          placeholder="Search courses"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search courses"
        />
      </div>

      <div className="myCoursesGrid">
        {(activeView === 'enrolled' ? enrolledCourses : browseCourses).length === 0 ? (
          <div className="myCoursesEmptyState" role="status">
            {activeView === 'enrolled'
              ? 'You are not enrolled in any course yet. Open Browse to enroll.'
              : 'No courses available for browsing right now.'}
          </div>
        ) : (
          (activeView === 'enrolled' ? enrolledCourses : browseCourses).map((course) => {
            const isEnrolled = enrolledCourseIds.includes(course.id);
            return (
              <article key={course.id} className="myCourseCard">
                <div className={`myCourseImage ${course.imageClass || 'courseImageBlue'}`} />
                <div className="myCourseBody">
                  <h4>{course.title}</h4>
                  <p>{course.subtitle}</p>
                  <small>{course.description}</small>
                  <small>Instructor: {course.instructor || 'Instructor'}</small>
                  <small>
                    Enrollment: {course.enrollmentKey ? 'Protected' : 'Public'}
                  </small>
                </div>
                <div className="myCourseActions">
                  {isEnrolled ? (
                    <button type="button" onClick={() => openCourse(course.id)}>
                      Open Course
                    </button>
                  ) : (
                    <button type="button" onClick={() => openEnrollFlow(course)}>
                      Enroll
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {activeCourse && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true">
          <div className="lightboxCard">
            <h3>Enter Course Key</h3>
            <p className="authSubtext">
              This course is protected. Please enter the Enrollment Key.
            </p>
            <div className="authForm">
              <label htmlFor="enrollment-key-input">Course Key</label>
              <input
                id="enrollment-key-input"
                value={enteredKey}
                onChange={(event) => setEnteredKey(event.target.value)}
                placeholder="Enter key provided by instructor"
              />
              {keyError && <p className="errorText">{keyError}</p>}
            </div>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={confirmProtectedEnrollment}>
                Confirm
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={closeKeyModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
