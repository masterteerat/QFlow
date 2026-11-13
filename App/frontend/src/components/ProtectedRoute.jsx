import { Navigate, Link } from 'react-router-dom';
import { getCustomer, getOwner, getTokenRole } from '../lib/auth';

/**
 * Wrapper for routes that require authentication
 * role="customer" -> needs a valid customer token, otherwise redirects to /login
 * role="owner"    -> needs a valid owner token, otherwise redirects to /owner/login
 *
 * Logged in with the OTHER role (e.g. a customer opening an owner page): shows a
 * "no permission" message instead of silently redirecting.
 */
export default function ProtectedRoute({ role, children }) {
  const user = role === 'owner' ? getOwner() : getCustomer();
  const loginPath = role === 'owner' ? '/owner/login' : '/login';
  const tokenRole = getTokenRole();

  if (tokenRole && tokenRole !== role) {
    const homePath = tokenRole === 'owner' ? '/owner/dashboard' : '/businesses';
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-ink-900">
        <div className="max-w-sm w-full text-center" role="alert">
          <p className="font-display text-2xl font-bold text-ink-900 dark:text-white">Access denied</p>
          <p className="text-ink-600 dark:text-ink-300 mt-2">
            You do not have permission to access this page.
          </p>
          <Link to={homePath} className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-brand-700 text-white font-bold">
            Go back to my home page
          </Link>
        </div>
      </div>
    );
  }

  if (!user?.id || tokenRole !== role) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
}
