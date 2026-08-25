import { Navigate } from 'react-router-dom';
import { getCustomer, getOwner } from '../lib/auth';

/**
 * Wrapper for routes that require authentication
 * role="customer" -> checks customer_user in localStorage, redirects to /login if missing
 * role="owner"     -> checks owner_user in localStorage, redirects to /owner/login if missing
 */
export default function ProtectedRoute({ role, children }) {
  const user = role === 'owner' ? getOwner() : getCustomer();
  const loginPath = role === 'owner' ? '/owner/login' : '/login';

  if (!user?.id) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
}