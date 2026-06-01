import { apiFetch } from './api';

export function fetchCourses() {
  return apiFetch('/api/courses').then((result) => result.data || []);
}

export function createCourse(courseData) {
  return apiFetch('/api/courses', {
    method: 'POST',
    body: JSON.stringify(courseData),
  }).then((result) => result.data);
}

export function updateCourse(courseId, courseData) {
  return apiFetch(`/api/courses/${courseId}`, {
    method: 'PUT',
    body: JSON.stringify(courseData),
  }).then((result) => result.data);
}

export function updateStudentCourseWork(courseId, courseData) {
  return apiFetch(`/api/courses/${courseId}/student-work`, {
    method: 'PUT',
    body: JSON.stringify(courseData),
  }).then((result) => result.data);
}

export function deleteCourse(courseId) {
  return apiFetch(`/api/courses/${courseId}`, {
    method: 'DELETE',
  });
}
