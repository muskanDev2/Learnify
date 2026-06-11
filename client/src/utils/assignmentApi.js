import { apiFetch } from './api';

export function submitAssignment(courseId, assignmentItemId, submissionData) {
  return apiFetch(`/api/assignments/${courseId}/${assignmentItemId}/submissions`, {
    method: 'POST',
    body: JSON.stringify(submissionData),
  }).then((result) => result.data);
}

export function fetchCourseAssignments(courseId) {
  return apiFetch(`/api/assignments/${courseId}`).then((result) => result.data || []);
}

export function createAssignment(courseId, assignmentData) {
  return apiFetch(`/api/assignments/${courseId}`, {
    method: 'POST',
    body: JSON.stringify(assignmentData),
  }).then((result) => result.data);
}

export function fetchMyAssignmentSubmission(courseId, assignmentItemId) {
  return apiFetch(`/api/assignments/${courseId}/${assignmentItemId}/submissions/me`).then(
    (result) => result.data || null,
  );
}

export function fetchAssignmentSubmissions(courseId, assignmentItemId) {
  return apiFetch(`/api/assignments/${courseId}/${assignmentItemId}/submissions`).then(
    (result) => result.data || [],
  );
}

export function gradeAssignmentSubmission(submissionId, gradeData) {
  return apiFetch(`/api/assignments/submissions/${submissionId}/grade`, {
    method: 'PUT',
    body: JSON.stringify(gradeData),
  }).then((result) => result.data);
}

export function deleteAssignmentSubmission(submissionId) {
  return apiFetch(`/api/assignments/submissions/${submissionId}`, {
    method: 'DELETE',
  });
}
