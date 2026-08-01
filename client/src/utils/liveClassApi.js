import { apiFetch } from './api';

export function fetchLiveClasses(courseId, { segment = 'all', moduleId } = {}) {
  const params = new URLSearchParams({ courseId: String(courseId) });
  if (segment && segment !== 'all') params.set('segment', segment);
  if (moduleId != null) params.set('moduleId', String(moduleId));
  return apiFetch(`/api/live-classes?${params.toString()}`).then((res) => res.data || []);
}

export function createLiveClass(payload) {
  return apiFetch('/api/live-classes', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((res) => res.data);
}

export function cancelLiveClass(liveClassId) {
  return apiFetch(`/api/live-classes/${liveClassId}/cancel`, {
    method: 'POST',
  }).then((res) => res.data);
}

export function syncLiveClassAttendance(liveClassId) {
  return apiFetch(`/api/live-classes/${liveClassId}/sync-attendance`, {
    method: 'POST',
  }).then((res) => res.data);
}

export function fetchLiveClassAttendance(liveClassId) {
  return apiFetch(`/api/live-classes/${liveClassId}/attendance`).then((res) => res.data || []);
}
