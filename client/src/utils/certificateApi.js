import { apiFetch } from './api';

export function fetchInstructorCertificateOverview() {
  return apiFetch('/api/certificates/instructor/overview').then((result) => result.data || []);
}

export function approveCertificate({ courseId, studentEmail, override = false }) {
  return apiFetch('/api/certificates/approve', {
    method: 'POST',
    body: JSON.stringify({ courseId, studentEmail, override }),
  }).then((result) => result.data);
}

export function fetchMyCertificates() {
  return apiFetch('/api/certificates/me').then((result) => result.data || []);
}
