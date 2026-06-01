import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/authUtils';
import {
  createCourse as createCourseRequest,
  deleteCourse as deleteCourseRequest,
  fetchCourses,
  updateCourse as updateCourseRequest,
} from '../utils/courseApi';
import { fetchEnrollments, manageEnrollment } from '../utils/enrollmentApi';
import { syncLmsSnapshotFromLocalSoon } from '../utils/lmsStorage';
import { fetchUsers } from '../utils/userApi';

const COURSES_KEY = 'learnify_courses';

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

function saveStoredCourses(courses) {
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  syncLmsSnapshotFromLocalSoon();
}

function buildStarterModules() {
  // Requirement: create a default module named "General" on course creation.
  return [{ id: 1, title: 'General', items: [] }];
}

function normalizeModules(modules) {
  if (!Array.isArray(modules) || modules.length === 0) return buildStarterModules();

  return modules.map((module) => ({
    id: module.id,
    title: module.title || 'Untitled module',
    items: Array.isArray(module.items) ? module.items : [],
  }));
}

export default function InstructorCoursesPanel() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const instructorName = currentUser?.name || 'Instructor';
  const instructorEmail = (currentUser?.email || '').toLowerCase();
  const [courses, setCourses] = useState(() =>
    getStoredCourses()
      .filter((course) => course.ownerEmail === instructorEmail)
      .map((course) => ({
        ...course,
        modules: normalizeModules(course.modules),
      })),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('last-accessed');
  const [viewType, setViewType] = useState('card');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [selectedStudentByCourse, setSelectedStudentByCourse] = useState({});
  const [courseForm, setCourseForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    instructor: instructorName,
    category: '',
    enrollmentKey: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadCoursesFromApi() {
      try {
        const [apiCourses, apiEnrollments, apiUsers] = await Promise.all([
          fetchCourses(),
          fetchEnrollments(),
          fetchUsers(),
        ]);
        if (!isMounted) return;

        saveStoredCourses(apiCourses);
        setEnrollments(apiEnrollments);
        setStudents(apiUsers.filter((user) => user.role === 'student' && user.active !== false));
        setCourses(
          apiCourses
            .filter((course) => (course.ownerEmail || '').toLowerCase() === instructorEmail)
            .map((course) => ({
              ...course,
              modules: normalizeModules(course.modules),
            })),
        );
        setStatusMessage('');
      } catch (error) {
        if (isMounted) {
          setStatusMessage(`Could not load courses from API: ${error.message}`);
        }
      }
    }

    loadCoursesFromApi();

    return () => {
      isMounted = false;
    };
  }, [instructorEmail]);

  const filteredCourses = useMemo(() => {
    const searched = courses.filter((course) =>
      course.title.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );

    const categorized = searched.filter((course) =>
      categoryFilter === 'All' ? true : course.category === categoryFilter,
    );

    // Hide already-duplicated identical courses in the UI (safe for beginner demo).
    const dedupeKey = (course) =>
      [
        (course.ownerEmail || '').toLowerCase(),
        course.title || '',
        course.subtitle || '',
        course.description || '',
        course.category || '',
        course.enrollmentKey || '',
      ].join('|');

    const seen = new Set();
    const uniqueCategorized = categorized.filter((course) => {
      const key = dedupeKey(course);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return [...uniqueCategorized].sort((a, b) => {
      if (sortBy === 'name') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.lastAccessed) - new Date(a.lastAccessed);
    });
  }, [courses, searchTerm, categoryFilter, sortBy]);

  function upsertCachedCourse(course) {
    const allCourses = getStoredCourses();
    const updatedCourses = [course, ...allCourses.filter((savedCourse) => savedCourse.id !== course.id)];
    saveStoredCourses(updatedCourses);
  }

  function removeCachedCourse(courseId) {
    saveStoredCourses(getStoredCourses().filter((course) => course.id !== courseId));
  }

  function openCreateModal() {
    setEditingCourseId(null);
    setCourseForm({
      title: '',
      subtitle: '',
      description: '',
      instructor: instructorName,
      category: '',
      enrollmentKey: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(course) {
    setEditingCourseId(course.id);
    setCourseForm({
      title: course.title,
      subtitle: course.subtitle,
      description: course.description || '',
      instructor: course.instructor || instructorName,
      category: course.category,
      enrollmentKey: course.enrollmentKey || '',
    });
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
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      if (editingCourseId) {
        const updatedCourse = await updateCourseRequest(editingCourseId, courseForm);
        setCourses((prev) =>
          prev.map((course) =>
            course.id === editingCourseId
              ? { ...updatedCourse, modules: normalizeModules(updatedCourse.modules) }
              : course,
          ),
        );
        upsertCachedCourse(updatedCourse);
      } else {
        const newCourse = await createCourseRequest(courseForm);
        setCourses((prev) => [{ ...newCourse, modules: normalizeModules(newCourse.modules) }, ...prev]);
        upsertCachedCourse(newCourse);
      }

      setIsModalOpen(false);
    } catch (error) {
      setStatusMessage(error.message || 'Course could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteCourse(courseId) {
    setDeletingCourseId(courseId);
  }

  async function confirmDeleteCourse() {
    if (!deletingCourseId) return;

    setIsSaving(true);
    setStatusMessage('');

    try {
      await deleteCourseRequest(deletingCourseId);
      setCourses((prev) => prev.filter((course) => course.id !== deletingCourseId));
      removeCachedCourse(deletingCourseId);
      setDeletingCourseId(null);
    } catch (error) {
      setStatusMessage(error.message || 'Course could not be deleted.');
    } finally {
      setIsSaving(false);
    }
  }

  function openContentManager(courseId) {
    navigate('/courses', { state: { courseId } });
  }

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
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="myCoursesSection">
      <div className="myCoursesHeader">
        <div>
          <h2>My courses</h2>
          <h3>Course overview</h3>
        </div>
        <button type="button" className="profilePrimaryButton" onClick={openCreateModal} disabled={isSaving}>
          Create Course
        </button>
      </div>

      {statusMessage && <p className="errorText formError">{statusMessage}</p>}

      <div className="myCoursesFilters">
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="All">All</option>
          <option value="AI">AI</option>
          <option value="Robotics">Robotics</option>
          <option value="Computer Science">Computer Science</option>
        </select>

        <input
          type="search"
          placeholder="Search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="last-accessed">Sort by last accessed</option>
          <option value="name">Sort by course name</option>
        </select>

        <select value={viewType} onChange={(event) => setViewType(event.target.value)}>
          <option value="card">Card</option>
          <option value="list">List</option>
        </select>
      </div>

      <div className={viewType === 'card' ? 'myCoursesGrid' : 'myCoursesList'}>
        {filteredCourses.length === 0 ? (
          <div className="myCoursesEmptyState" role="status">
            No courses added yet. Start by clicking <strong>Create Course</strong> to build your first course.
          </div>
        ) : (
          filteredCourses.map((course) => (
            <article key={course.id} className="myCourseCard">
              <div className={`myCourseImage ${course.imageClass}`} />
              <div className="myCourseBody">
                <h4>{course.title}</h4>
                <p>{course.subtitle}</p>
                <small>{course.description}</small>
                <small>Instructor: {course.instructor}</small>
                <small>{course.category}</small>
                <small>
                  Enrollment: {course.enrollmentKey ? 'Protected' : 'Public'}
                </small>
              </div>
              <div className="enrollmentActionCard enrollmentActionCardCompact">
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
                <button
                  type="button"
                  className="enrollmentToggleButton"
                  onClick={() => handleEnrollmentToggle(course)}
                  disabled={isSaving || !students.length}
                >
                  {isStudentEnrolled(getSelectedStudent(course.id), course.id)
                    ? 'Unenroll learner'
                    : 'Enroll learner'}
                </button>
              </div>
              <div className="myCourseActions">
              <button type="button" onClick={() => openContentManager(course.id)} disabled={isSaving}>
                  Manage Content
                </button>
                <button type="button" onClick={() => openEditModal(course)} disabled={isSaving}>Edit</button>
                <button type="button" onClick={() => handleDeleteCourse(course.id)} disabled={isSaving}>Delete</button>
              </div>
            </article>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true">
          <div className="lightboxCard">
            <h3>{editingCourseId ? 'Edit course' : 'Create course'}</h3>
            <div className="authForm">
              <label htmlFor="course-title">Course title</label>
              <input
                id="course-title"
                name="title"
                value={courseForm.title}
                onChange={handleFormChange}
                autoComplete="off"
              />

              <label htmlFor="course-subtitle">Term / subtitle</label>
              <input
                id="course-subtitle"
                name="subtitle"
                value={courseForm.subtitle}
                onChange={handleFormChange}
                autoComplete="off"
              />

              <label htmlFor="course-category">Category</label>
              <input
                id="course-category"
                name="category"
                value={courseForm.category}
                onChange={handleFormChange}
                placeholder="AI, Robotics, Computer Science..."
                autoComplete="off"
              />

              <label htmlFor="course-description">Description</label>
              <textarea
                id="course-description"
                name="description"
                value={courseForm.description}
                onChange={handleFormChange}
                rows={3}
                placeholder="Write short course description..."
                autoComplete="off"
              />

              <label htmlFor="course-enrollment-key">Enrollment Key (optional)</label>
              <input
                id="course-enrollment-key"
                name="enrollmentKey"
                value={courseForm.enrollmentKey}
                onChange={handleFormChange}
                placeholder="Set key to protect enrollment (leave blank for Public)"
                autoComplete="off"
              />

              <label htmlFor="course-instructor">Instructor</label>
              <input id="course-instructor" value={courseForm.instructor} readOnly autoComplete="off" />
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

      {deletingCourseId && (
        <div className="lightboxOverlay" role="alertdialog" aria-modal="true" aria-labelledby="course-delete-title">
          <div className="lightboxCard courseDeleteCard">
            <h3 id="course-delete-title">Delete Course</h3>
            <p>
              Are you sure you want to delete this course? 
            </p>
            <div className="profileModalActions">
              <button type="button" className="profileDangerButton" onClick={confirmDeleteCourse} disabled={isSaving}>
                {isSaving ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                className="heroButton heroButtonSecondary"
                onClick={() => setDeletingCourseId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
