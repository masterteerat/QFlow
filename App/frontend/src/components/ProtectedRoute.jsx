import { Navigate } from 'react-router-dom';
import { getCustomer, getOwner, getTokenRole } from '../lib/auth';

/**
 * Wrapper for routes that require authentication
 * role="customer" -> needs a valid customer token, otherwise redirects to /login
 * role="owner"    -> needs a valid owner token, otherwise redirects to /owner/login
 *
 * FIX: it only checked localStorage for a user object, so an expired/missing token or a token for the
 * other role still opened the page and every API call then failed with 401/403.
 */
export default function ProtectedRoute({ role, children }) {
  const user = role === 'owner' ? getOwner() : getCustomer();
  const loginPath = role === 'owner' ? '/owner/login' : '/login';

  if (!user?.id || getTokenRole() !== role) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
}
