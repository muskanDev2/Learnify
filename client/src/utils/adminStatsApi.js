import { apiFetch } from './api';
import { adminReportFilterToQueryParams } from './reportFilters';

export function fetchAdminUserStats() {
  return apiFetch('/api/admin/stats/users').then((result) => result.data);
}

export function fetchAdminProgressStats() {
  return apiFetch('/api/admin/stats/progress').then((result) => result.data);
}

export function fetchAdminReports(filter = { period: 'all_time', courseId: 'all' }) {
  const query = adminReportFilterToQueryParams(filter).toString();
  return apiFetch(`/api/admin/reports?${query}`).then((result) => result.data);
}
