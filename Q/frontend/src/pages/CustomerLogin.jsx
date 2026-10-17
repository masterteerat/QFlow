import { useState } from 'react';
import AuthShell from '../components/AuthShell';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../lib/api';
import useDevLogin from '../lib/useDevLogin';
import OTPModal from '../components/OTPModal';

export default function CustomerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();
  const devLoginEnabled = useDevLogin();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      const data = await api.post('/customer/login', { email, password });
      if (!data.success) return setError(data.message);

      if (data.requireOTP) {
        setOtpEmail(data.email);
        setShowOTP(true);
      } else if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('customer_user', JSON.stringify(data.user));
        navigate('/businesses');
      }
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleVerifyOTP = async (email, otp) => {
    const data = await api.post('/customer/verify-otp', { email, otp });
    if (!data.success) throw new Error(data.message);
    localStorage.setItem('token', data.token);
    localStorage.setItem('customer_user', JSON.stringify(data.user));
    setShowOTP(false);
    navigate('/businesses');
  };

  const handleResendOTP = async (email) => {
    const data = await api.post('/customer/resend-otp', { email });
    if (!data.success) throw new Error(data.message);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await api.post('/customer/google-login', { 
        credential: credentialResponse.credential 
      });
      if (!data.success) return setError(data.message);

      if (data.token) localStorage.setItem('token', data.token);
      localStorage.setItem('customer_user', JSON.stringify(data.user));
      navigate('/businesses');
    } catch {
      setError('Google Login Failed. Could not connect to server.');
    }
  };

  // Quick Login now asks the backend for a REAL, properly-signed JWT
  // (via /customer/dev-login) instead of stashing a fake 'bypass-test-token'
  // string in localStorage. The old fake token could not be verified by
  // jwt.verify() on the backend, so any authenticated request made while
  // "quick logged in" would silently fail auth server-side.
  const handleQuickLogin = async () => {
    setError('');
    setLoggingIn(true);
    try {
      const data = await api.post('/customer/dev-login', {});
      if (!data.success) return setError(data.message);
      localStorage.setItem('token', data.token);
      localStorage.setItem('customer_user', JSON.stringify(data.user));
      navigate('/businesses');
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <AuthShell variant="customer" title="Welcome back" subtitle="Log in to see your tickets and book your next visit.">

        {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-ink-700 dark:text-ink-300 text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              required
              className="w-full border border-ink-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white p-2 rounded focus:outline-none focus:border-brand-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loggingIn}
            />
          </div>

          <div>
            <label className="block text-ink-700 dark:text-ink-300 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full border border-ink-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white p-2 rounded focus:outline-none focus:border-brand-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loggingIn}
            />
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className="bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 text-white font-bold py-2 px-4 rounded transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingIn ? 'Logging in...' : 'Sign in'}
          </button>

          {devLoginEnabled && (

          <button 
            type="button" 
            onClick={handleQuickLogin}
            disabled={loggingIn}
            className="bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingIn ? 'Logging in...' : 'Quick Login (Test Customer)'}
          </button>

          )}
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="relative flex items-center py-2 w-full">
              <div className="flex-grow border-t border-ink-200 dark:border-ink-600"></div>
              <span className="flex-shrink-0 mx-4 text-ink-400 dark:text-ink-400 text-sm font-medium">Or</span>
              <div className="flex-grow border-t border-ink-200 dark:border-ink-600"></div>
            </div>

            <GoogleLogin 
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login Failed')}
              useOneTap={false}
              locale="en"
            />
          </div>
        </form>

        <div className="mt-4 text-sm text-center flex flex-col gap-2">
          <p className="text-ink-700 dark:text-ink-300">
            No account? <Link to="/signup" className="text-brand-700 dark:text-brand-400 hover:underline">Sign up</Link>
          </p>
          <p className="text-ink-500 dark:text-ink-400 text-xs mt-4">
            Shop owner? <Link to="/owner/login" className="text-brand-700 dark:text-brand-400 hover:underline">Owner login</Link>
          </p>
        </div>

        <OTPModal
          isOpen={showOTP}
          onClose={() => setShowOTP(false)}
          onVerify={handleVerifyOTP}
          email={otpEmail}
          
          onResend={handleResendOTP}
        />
    </AuthShell>
  );
}