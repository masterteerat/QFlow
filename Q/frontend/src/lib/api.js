import { clearSession, getTokenRole } from './auth';

function buildUrl(path, params) {
  if (!params) return `/api${path}`;
  const search = new URLSearchParams(params).toString();
  return `/api${path}${search ? '?' + search : ''}`;
}

async function request(path, options = {}) {
  const { params, ...config } = options;
  const url = buildUrl(path, params);

  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  if (config.body instanceof FormData) {
    // Let the browser set multipart Content-Type (with boundary) itself.
    config.headers = { ...authHeader, ...config.headers };
  } else {
    config.headers = { 'Content-Type': 'application/json', ...authHeader, ...config.headers };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch {
    return { success: false, message: 'Cannot reach the server. Please try again.' };
  }

  // FIX: used to call res.json() blindly, which threw on empty/HTML error pages.
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && token && !path.includes('login') && !path.includes('otp')) {
    const role = getTokenRole() || (window.location.pathname.startsWith('/owner') ? 'owner' : 'customer');
    clearSession();
    window.location.assign(role === 'owner' ? '/owner/login' : '/login');
    return { success: false, message: 'Session expired. Please log in again.' };
  }
  if (!data || typeof data !== 'object') {
    return { success: false, message: `Request failed (${res.status}).` };
  }
  if (!res.ok && data.success === undefined) data.success = false;
  return data;
}

export const api = {
  get: (path, params) => request(path, params ? { params } : {}),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  // FIX: OwnerHome called api.delete, which did not exist
  delete: (path, body) => request(path, { method: 'DELETE', body })
};
