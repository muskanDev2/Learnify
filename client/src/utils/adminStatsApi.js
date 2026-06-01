import { apiFetch } from './api';

export function fetchAdminUserStats() {
  return apiFetch('/api/admin/stats/users').then((result) => result.data);
}

export function fetchAdminProgressStats() {
  return apiFetch('/api/admin/stats/progress').then((result) => result.data);
}
