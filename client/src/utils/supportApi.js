import { apiFetch } from './api';

export function submitSupportRequest(payload) {
  return apiFetch('/api/support/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((result) => result.data);
}

export function fetchMySupportRequests() {
  return apiFetch('/api/support/requests/me').then((result) => result.data || []);
}
