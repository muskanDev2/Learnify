const RENDER_API = 'https://learnify-api-2con.onrender.com';

function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');

  // Never use localhost in production builds (common Vercel misconfiguration).
  if (fromEnv && !(import.meta.env.PROD && fromEnv.includes('localhost'))) {
    return fromEnv;
  }

  // Production: empty base = same-origin /api/* (proxied by vercel.json → Render).
  if (import.meta.env.PROD) {
    return '';
  }

  return 'http://localhost:5000';
}

const API_BASE = resolveApiBase();

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export async function checkApiHealth() {
  return apiFetch('/api/health');
}

export { API_BASE, RENDER_API };
