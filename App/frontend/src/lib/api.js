function buildUrl(path, params) {
  if (!params) return `/api${path}`;
  const search = new URLSearchParams(params).toString();
  return `/api${path}${search ? '?' + search : ''}`;
}

async function request(path, options = {}) {
  const config = { ...options };
  const url = buildUrl(path, options.params);

  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  if (config.body instanceof FormData) {
    // Let the browser set the multipart Content-Type (with boundary) itself;
    // only attach the auth header here.
    config.headers = { ...authHeader, ...config.headers };
  } else if (!config.headers || !config.headers['Content-Type']) {
    config.headers = { 'Content-Type': 'application/json', ...authHeader, ...config.headers };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
  } else {
    config.headers = { ...authHeader, ...config.headers };
  }

  const res = await fetch(url, config);
  const data = await res.json();
  return data;
}

export const api = {
  get: (path, params) => request(path, params ? { params } : {}),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ? body : undefined })
};