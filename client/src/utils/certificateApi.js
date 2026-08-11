import { API_BASE, apiFetch } from './api';

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

function slugFilePart(value) {
  return String(value || '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Download certificate PDF via authenticated API (avoids 401 on private Cloudinary / stale URLs).
 */
export async function downloadCertificatePdf({ courseId, studentEmail, courseTitle, studentName }) {
  const token = localStorage.getItem('learnify_auth_token');
  const params = new URLSearchParams();
  if (studentEmail) params.set('studentEmail', studentEmail);
  const query = params.toString();
  const url = `${API_BASE}/api/certificates/download/${courseId}${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Could not download certificate (${response.status}).`);
  }

  const blob = await response.blob();
  const fileName = `${slugFilePart(courseTitle || 'certificate')}-${slugFilePart(studentName || 'student')}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
