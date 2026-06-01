import { apiFetch } from './api';

export function fetchProgress() {
  return apiFetch('/api/progress').then((result) => result.data || {});
}

export function saveProgress(courseId, itemId, completed = true) {
  return apiFetch('/api/progress/item/complete', {
    method: 'PUT',
    body: JSON.stringify({ courseId, itemId, completed }),
  }).then((result) => result.data || {});
}

export function openContent(courseId, itemId) {
  return apiFetch('/api/progress/content/open', {
    method: 'POST',
    body: JSON.stringify({ courseId, itemId }),
  });
}

export function saveContentTime(courseId, itemId, seconds) {
  return apiFetch('/api/progress/content/time', {
    method: 'PUT',
    body: JSON.stringify({ courseId, itemId, seconds }),
  });
}

export function fetchMyProgress(courseId) {
  const path = courseId ? `/api/progress/me/${courseId}` : '/api/progress/me';
  return apiFetch(path).then((result) => result.data || null);
}
