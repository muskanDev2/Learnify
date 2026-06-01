import { apiFetch } from './api';

export function fetchMe() {
  return apiFetch('/api/users/me').then((result) => result.data);
}

export function updateMe(profileUpdates) {
  return apiFetch('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(profileUpdates),
  }).then((result) => result.data);
}

export function fetchUsers() {
  return apiFetch('/api/users').then((result) => result.data || []);
}

export function updateUser(userId, updates) {
  return apiFetch(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }).then((result) => result.data);
}

export function deleteUser(userId) {
  return apiFetch(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}
