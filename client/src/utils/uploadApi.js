import { API_BASE } from './api';

export function uploadFiles(files, onProgress) {
  const fileList = Array.from(files || []);
  if (!fileList.length) {
    return Promise.resolve([]);
  }

  const formData = new FormData();
  fileList.forEach((file) => formData.append('files', file));

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const token = localStorage.getItem('learnify_auth_token');

    request.open('POST', `${API_BASE}/api/uploads`);
    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== 'function') return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      const payload = JSON.parse(request.responseText || '{}');
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve(payload.data || []);
        return;
      }

      reject(new Error(payload.message || `Upload failed (${request.status})`));
    };

    request.onerror = () => reject(new Error('Upload failed. Please check your connection and try again.'));
    request.send(formData);
  });
}
