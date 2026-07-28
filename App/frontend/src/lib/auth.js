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
