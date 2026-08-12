import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCourse as createCourseRequest, fetchCourses } from '../utils/courseApi';
import { fetchEnrollments, manageEnrollment } from '../utils/enrollmentApi';
import { fetchUsers } from '../utils/userApi';
import { getCurrentUser } from '../utils/authUtils';

export default function AdminCoursesPanel() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('new'); // new | old | name
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    category: '',
    enrollmentKey: '',
  });

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

  function openCreateModal() {
    setCourseForm({
      title: '',
      subtitle: '',
      description: '',
      category: '',
      enrollmentKey: '',
    });
    setStatusMessage('');
    setIsModalOpen(true);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setCourseForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSaveCourse() {
    if (
      !courseForm.title.trim() ||
      !courseForm.subtitle.trim() ||
      !courseForm.description.trim() ||
      !courseForm.category.trim()
    ) {
      setStatusMessage('Title, subtitle, description, and category are required.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      const newCourse = await createCourseRequest(courseForm);
      setCourses((prev) => [newCourse, ...prev]);
      setIsModalOpen(false);
      setStatusMessage(`${newCourse.title} created successfully.`);
    } catch (error) {
      setStatusMessage(error.message || 'Course could not be saved.');
    } finally {
      setIsSaving(false);
    }
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
      <div className="myCoursesHeader">
        <div>
          <h3>Courses</h3>
          <p>All courses across the platform. Open any course for detailed editing.</p>
        </div>
        <button type="button" className="profilePrimaryButton" onClick={openCreateModal} disabled={isSaving}>
          Create Course
        </button>
      </div>
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

      {isModalOpen && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true">
          <div className="lightboxCard">
            <h3>Create course</h3>
            <div className="authForm">
              {statusMessage && <p className="errorText formError">{statusMessage}</p>}
              <label htmlFor="admin-course-title">Course title</label>
              <input
                id="admin-course-title"
                name="title"
                value={courseForm.title}
                onChange={handleFormChange}
                autoComplete="off"
              />
              <label htmlFor="admin-course-subtitle">Term / subtitle</label>
              <input
                id="admin-course-subtitle"
                name="subtitle"
                value={courseForm.subtitle}
                onChange={handleFormChange}
                autoComplete="off"
              />
              <label htmlFor="admin-course-category">Category</label>
              <input
                id="admin-course-category"
                name="category"
                value={courseForm.category}
                onChange={handleFormChange}
                placeholder="AI, Robotics, Computer Science..."
                autoComplete="off"
              />
              <label htmlFor="admin-course-description">Description</label>
              <textarea
                id="admin-course-description"
                name="description"
                value={courseForm.description}
                onChange={handleFormChange}
                rows={3}
                placeholder="Write short course description..."
                autoComplete="off"
              />
              <label htmlFor="admin-course-enrollment-key">Enrollment Key (optional)</label>
              <input
                id="admin-course-enrollment-key"
                name="enrollmentKey"
                value={courseForm.enrollmentKey}
                onChange={handleFormChange}
                placeholder="Set key to protect enrollment (leave blank for Public)"
                autoComplete="off"
              />
              <label htmlFor="admin-course-instructor">Instructor</label>
              <input id="admin-course-instructor" value={currentUser?.name || 'Admin'} readOnly autoComplete="off" />
            </div>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={handleSaveCourse} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
