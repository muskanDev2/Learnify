import { apiFetch } from './api';

export function fetchNotifications({ page = 1, limit = 10, status = 'all' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status !== 'all') params.set('status', status);
  return apiFetch(`/api/notifications?${params.toString()}`).then((result) => result.data);
}

export function fetchUnreadNotificationCount() {
  return apiFetch('/api/notifications/unread-count').then((result) => result.data?.count || 0);
}

export function markNotificationRead(notificationId) {
  return apiFetch(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
  }).then((result) => result.data);
}

export function markAllNotificationsRead() {
  return apiFetch('/api/notifications/mark-all-read', {
    method: 'PUT',
  });
}

export function deleteNotification(notificationId) {
  return apiFetch(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
  });
}

export function fetchNotificationPreferences() {
  return apiFetch('/api/notifications/preferences').then((result) => result.data);
}

export function updateNotificationPreferences(preferences) {
  return apiFetch('/api/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  }).then((result) => result.data);
}
