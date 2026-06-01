import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCourses } from '../utils/courseApi';
import { fetchEnrollments, manageEnrollment } from '../utils/enrollmentApi';
import { fetchUsers } from '../utils/userApi';

export default function AdminCoursesPanel() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('new'); // new | old | name

  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [selectedStudentByCourse, setSelectedStudentByCourse] = useState({});
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    Promise.all([fetchUsers(), fetchCourses(), fetchEnrollments()])
      .then(([apiUsers, apiCourses, apiEnrollments]) => {
        setUsers(apiUsers);
        setCourses(apiCourses);
        setEnrollments(apiEnrollments);
      })
      .catch((error) => setStatusMessage(`Could not load courses: ${error.message}`));
  }, []);

  const students = useMemo(
    () => users.filter((user) => user.role === 'student' && user.active !== false),
    [users],
  );

  const ownerByEmail = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      map.set((user.email || '').toLowerCase(), user.name || user.email || 'Unknown');
    });
    return map;
  }, [users]);

  const enrollmentsCountByCourseId = useMemo(() => {
    const countMap = new Map();
    Object.values(enrollments).forEach((courseIds) => {
      if (!Array.isArray(courseIds)) return;
      courseIds.forEach((courseId) => {
        countMap.set(courseId, (countMap.get(courseId) || 0) + 1);
      });
    });
    return countMap;
  }, [enrollments]);

  function getSelectedStudent(courseId) {
    const selectedId = selectedStudentByCourse[courseId] || students[0]?.id || '';
    return students.find((student) => student.id === selectedId) || null;
  }

  function isStudentEnrolled(student, courseId) {
    if (!student) return false;
    return (enrollments[student.email?.toLowerCase()] || []).includes(courseId);
  }

  async function handleEnrollmentToggle(course) {
    const student = getSelectedStudent(course.id);
    if (!student) return;

    const enrolled = isStudentEnrolled(student, course.id);
    setStatusMessage('');

    try {
      const updatedEnrollments = await manageEnrollment({
        courseId: course.id,
        studentId: student.id,
        status: enrolled ? 'dropped' : 'active',
      });
      setEnrollments(updatedEnrollments);
      setStatusMessage(`${student.name} ${enrolled ? 'unenrolled from' : 'enrolled in'} ${course.title}.`);
    } catch (error) {
      setStatusMessage(error.message || 'Enrollment update failed.');
    }
  }

  const filteredCourses = useMemo(() => {
    const searched = courses.filter((course) => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        (course.title || '').toLowerCase().includes(q) ||
        (ownerByEmail.get((course.ownerEmail || '').toLowerCase()) || '')
          .toLowerCase()
          .includes(q)
      );
    });

    const withPosition = searched.map((course, index) => ({ ...course, __position: index }));
    if (sortBy === 'name') {
      return [...withPosition].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    if (sortBy === 'old') {
      return [...withPosition].sort((a, b) => a.__position - b.__position);
    }
    return [...withPosition].sort((a, b) => b.__position - a.__position);
  }, [courses, ownerByEmail, searchTerm, sortBy]);

  return (
    <div className="dashboardPanel">
      <h3>Courses</h3>
      <p>All courses across the platform. Open any course for detailed editing.</p>
      {statusMessage && <p className="dashboardFeedback">{statusMessage}</p>}

      <div className="myCoursesFilters">
        <input
          type="search"
          placeholder="Search by title or owner"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search courses"
        />
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          aria-label="Sort courses"
        >
          <option value="new">Sort by new</option>
          <option value="old">Sort by old</option>
          <option value="name">Sort by name</option>
        </select>
      </div>

      <section className="adminUsersTable adminUsersTableWide">
        <div className="adminUsersTableHeader adminCoursesTableHeaderWide">
          <span>Owner</span>
          <span>Title</span>
          <span>Enrollments</span>
          <span>Visibility</span>
          <span>Actions</span>
        </div>

        {filteredCourses.length ? (
          filteredCourses.map((course) => (
            <div key={course.id} className="adminUsersTableRow adminCoursesTableRowWide">
              <span>
                {ownerByEmail.get((course.ownerEmail || '').toLowerCase()) ||
                  course.instructor ||
                  'Unknown'}
              </span>
              <span>{course.title || 'Untitled course'}</span>
              <span>{String(enrollmentsCountByCourseId.get(course.id) || 0)}</span>
              <span>{course.enrollmentKey ? 'Protected' : 'Public'}</span>
              <span className="adminUsersActions">
                <div className="enrollmentActionCard">
                  <div className="enrollmentActionHeader">
                    <span>Manage learner</span>
                    <strong>
                      {isStudentEnrolled(getSelectedStudent(course.id), course.id)
                        ? 'Enrolled'
                        : 'Not enrolled'}
                    </strong>
                  </div>
                  <select
                    className="enrollmentSelect"
                    value={selectedStudentByCourse[course.id] || students[0]?.id || ''}
                    onChange={(event) =>
                      setSelectedStudentByCourse((prev) => ({
                        ...prev,
                        [course.id]: event.target.value,
                      }))
                    }
                    aria-label={`Select student for ${course.title}`}
                  >
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name || student.email}
                      </option>
                    ))}
                  </select>
                  <div className="enrollmentActionButtons">
                    <button
                      type="button"
                      className="enrollmentToggleButton"
                      onClick={() => handleEnrollmentToggle(course)}
                      disabled={!students.length}
                    >
                      {isStudentEnrolled(getSelectedStudent(course.id), course.id)
                        ? 'Unenroll learner'
                        : 'Enroll learner'}
                    </button>
                    <button
                      type="button"
                      className="enrollmentOpenButton"
                      onClick={() => navigate('/courses', { state: { courseId: course.id } })}
                    >
                      Open Course
                    </button>
                  </div>
                </div>
              </span>
            </div>
          ))
        ) : (
          <div className="adminUsersTableRow adminCoursesTableRowWide">
            <span>No courses found.</span>
            <span>-</span>
            <span>-</span>
            <span>-</span>
            <span>-</span>
          </div>
        )}
      </section>
    </div>
  );
}
