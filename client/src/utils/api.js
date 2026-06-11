const RENDER_API = 'https://learnify-api-2con.onrender.com';

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? RENDER_API : 'http://localhost:5000')
).replace(/\/$/, '');

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const token = localStorage.getItem('learnify_auth_token');
  const isFormData = options.body instanceof FormData;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(
      `Could not reach the Learnify API at ${API_BASE}. Make sure the backend server is running and MongoDB is connected.`,
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export async function checkApiHealth() {
  return apiFetch('/api/health');
}

export { API_BASE };
