import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredUsers } from '../utils/authUtils';

const COURSES_KEY = 'learnify_courses';
const ENROLLMENTS_KEY = 'learnify_enrollments';

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

export default function AdminCoursesPanel() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('new'); // new | old | name

  const users = getStoredUsers();
  const courses = getStoredCourses();
  const enrollments = getStoredEnrollments();

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
                <button
                  type="button"
                  className="profilePrimaryButton"
                  onClick={() => navigate('/courses', { state: { courseId: course.id } })}
                >
                  Open Course
                </button>
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
