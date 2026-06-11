import { API_BASE } from './api';

function getAuthHeaders() {
  const token = localStorage.getItem('learnify_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCloudinaryResourceType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'raw';
}

async function fetchCloudinarySignature() {
  const response = await fetch(`${API_BASE}/api/uploads/cloudinary/signature`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  return payload.data || null;
}

async function saveCloudinaryAsset(file, cloudinaryResult, resourceType) {
  const response = await fetch(`${API_BASE}/api/uploads/cloudinary/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      url: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      resourceType: cloudinaryResult.resource_type || resourceType,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Upload completed, but metadata could not be saved.');
  }

  return payload.data;
}

function uploadFileToCloudinary(file, signatureData, onProgress) {
  const resourceType = getCloudinaryResourceType(file);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signatureData.apiKey);
  formData.append('timestamp', signatureData.timestamp);
  formData.append('folder', signatureData.folder);
  formData.append('signature', signatureData.signature);
  if (signatureData.uploadPreset) {
    formData.append('upload_preset', signatureData.uploadPreset);
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${resourceType}/upload`,
    );

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== 'function') return;
      // Reserve the last 5% for saving metadata to our API.
      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
    };

    request.onload = () => {
      const payload = JSON.parse(request.responseText || '{}');
      if (request.status >= 200 && request.status < 300) {
        resolve({ payload, resourceType });
        return;
      }

      reject(new Error(payload.error?.message || `Cloud upload failed (${request.status})`));
    };

    request.onerror = () => reject(new Error('Cloud upload failed. Please check your connection and try again.'));
    request.send(formData);
  });
}

async function uploadFilesDirectly(files, onProgress) {
  const signatureData = await fetchCloudinarySignature();
  if (!signatureData) return null;

  const uploaded = [];
  const fileList = Array.from(files);

  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index];
    const baseProgress = Math.round((index / fileList.length) * 100);
    const sliceSize = 100 / fileList.length;
    const updateProgress = (fileProgress) => {
      onProgress?.(Math.min(99, Math.round(baseProgress + (fileProgress / 100) * sliceSize)));
    };

    const { payload, resourceType } = await uploadFileToCloudinary(file, signatureData, updateProgress);
    const asset = await saveCloudinaryAsset(file, payload, resourceType);
    uploaded.push(asset);
    onProgress?.(Math.min(99, Math.round(((index + 1) / fileList.length) * 100)));
  }

  onProgress?.(100);
  return uploaded;
}

function uploadFilesThroughServer(files, onProgress) {
  const fileList = Array.from(files || []);
  if (!fileList.length) {
    return Promise.resolve([]);
  }

  const formData = new FormData();
  fileList.forEach((file) => formData.append('files', file));

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('POST', `${API_BASE}/api/uploads`);
    Object.entries(getAuthHeaders()).forEach(([key, value]) => request.setRequestHeader(key, value));

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== 'function') return;
      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
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

export async function uploadFiles(files, onProgress) {
  const fileList = Array.from(files || []);
  if (!fileList.length) return [];

  try {
    const directUploadResult = await uploadFilesDirectly(fileList, onProgress);
    if (directUploadResult) return directUploadResult;
  } catch (error) {
    console.warn('Direct Cloudinary upload failed; retrying through server.', error.message);
    onProgress?.(1);
  }

  return uploadFilesThroughServer(fileList, onProgress);
}
