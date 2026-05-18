const RENDER_API = 'https://learnify-api-2con.onrender.com';

function getApiBase() {
  const fromEnv = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');

  if (import.meta.env.PROD) {
    // On Vercel: only trust https URLs (ignore accidental localhost in env vars)
    if (fromEnv?.startsWith('https://')) return fromEnv;
    return RENDER_API;
  }

  return fromEnv || 'http://localhost:5000';
}

const API_BASE = getApiBase();

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export async function checkApiHealth() {
  const delays = [0, 3000, 6000];
  let lastError;

  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      return await apiFetch('/api/health');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export { API_BASE };
