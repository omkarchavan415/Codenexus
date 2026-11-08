const BASE = import.meta.env.VITE_API_URL || '';
const REFRESH_KEY = 'cn_refresh_token';

let accessToken = null;
let onAuthLost = () => {};
let refreshing = null;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safe = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ }
  },
};

export function setAuthLostHandler(fn) { onAuthLost = fn; }
export function hasSession() { return Boolean(safe.get(REFRESH_KEY)); }
export function setTokens({ accessToken: a, refreshToken: r }) {
  accessToken = a || null;
  if (r) safe.set(REFRESH_KEY, r);
}
export function clearTokens() {
  accessToken = null;
  safe.remove(REFRESH_KEY);
}

async function raw(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const e = data && data.error;
    throw new ApiError(res.status, (e && e.code) || 'error', (e && e.message) || `Request failed (${res.status})`, e && e.details);
  }
  return data;
}

/** Exchange the stored refresh token for a new pair. Concurrent callers share one request. */
export function refreshSession() {
  if (refreshing) return refreshing;
  const token = safe.get(REFRESH_KEY);
  if (!token) return Promise.reject(new ApiError(401, 'no_session', 'Please sign in'));
  refreshing = raw('/api/auth/refresh', { method: 'POST', body: { refreshToken: token } })
    .then((data) => {
      setTokens(data);
      return data;
    })
    .catch((err) => {
      if (err.status === 401 || err.status === 400) clearTokens();
      throw err;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, options = {}) {
  const { auth = true, ...rest } = options;
  if (!auth) return raw(path, rest);
  if (!accessToken && hasSession()) {
    try { await refreshSession(); } catch { onAuthLost(); throw new ApiError(401, 'no_session', 'Please sign in again'); }
  }
  try {
    return await raw(path, { ...rest, token: accessToken });
  } catch (err) {
    if (err.status !== 401) throw err;
    try {
      await refreshSession();
    } catch {
      onAuthLost();
      throw err;
    }
    return raw(path, { ...rest, token: accessToken });
  }
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: body ?? {} });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const del = (p) => api(p, { method: 'DELETE' });
