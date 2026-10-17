export function getCustomer() {
  try {
    return JSON.parse(localStorage.getItem('customer_user'));
  } catch {
    return null;
  }
}

export function getOwner() {
  try {
    return JSON.parse(localStorage.getItem('owner_user'));
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('customer_user');
  localStorage.removeItem('owner_user');
}

// Reads the role out of the stored JWT (no verification - the server does that on every request).
// Returns null when there is no token, it is malformed, or it has expired.
export function getTokenRole() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.role || null;
  } catch {
    return null;
  }
}
