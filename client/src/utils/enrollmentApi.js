import { apiFetch } from './api';

export function fetchEnrollments() {
  return apiFetch('/api/enrollments').then((result) => result.data || {});
}

export function enrollInCourse(courseId, enrollmentKey = '') {
  return apiFetch('/api/enrollments', {
    method: 'POST',
    body: JSON.stringify({ courseId, enrollmentKey }),
  }).then((result) => result.data || {});
}

export function manageEnrollment({ courseId, studentId, studentEmail, status = 'active' }) {
  return apiFetch('/api/enrollments/manage', {
    method: 'POST',
    body: JSON.stringify({ courseId, studentId, studentEmail, status }),
  }).then((result) => result.data || {});
}
