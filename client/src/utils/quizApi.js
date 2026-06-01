import { apiFetch } from './api';

export function submitQuizAttempt(courseId, quizItemId, attemptData) {
  return apiFetch(`/api/quizzes/${courseId}/${quizItemId}/attempts/submit`, {
    method: 'POST',
    body: JSON.stringify(attemptData),
  }).then((result) => result.data);
}

export function fetchMyQuizAttempts(courseId, quizItemId) {
  return apiFetch(`/api/quizzes/${courseId}/${quizItemId}/attempts/me`).then(
    (result) => result.data || [],
  );
}
