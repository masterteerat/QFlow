import { useState } from 'react';
import AuthShell from '../components/AuthShell';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import useDevLogin from '../lib/useDevLogin';
import { GoogleLogin } from '@react-oauth/google';
import OTPModal from '../components/OTPModal';

export default function OwnerLogin() {
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
      const data = await api.post('/owner/login', { email, password });
      if (!data.success) return setError(data.message);

      if (data.requireOTP) {
        setOtpEmail(data.email);
        setShowOTP(true);
      } else if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('owner_user', JSON.stringify(data.owner));
        navigate('/owner/dashboard');
      }
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleVerifyOTP = async (email, otp) => {
    const data = await api.post('/owner/verify-otp', { email, otp });
    if (!data.success) throw new Error(data.message);
    localStorage.setItem('token', data.token);
    localStorage.setItem('owner_user', JSON.stringify(data.owner));
    setShowOTP(false);
    navigate('/owner/dashboard');
  };

  const handleResendOTP = async (email) => {
    const data = await api.post('/owner/resend-otp', { email });
    if (!data.success) throw new Error(data.message);
  };

  // Quick Login now asks the backend for a REAL, properly-signed JWT
  // (via /owner/dev-login) instead of stashing a fake 'bypass-test-token'
  // string in localStorage. The old fake token could not be verified by
  // jwt.verify() on the backend, so req.user was never set and anything
  // behind auth (like scanning a customer's QR to check them in) failed
  // with "Please log in again" even though the UI looked logged in.
  const handleQuickLogin = async () => {
    setError('');
    setLoggingIn(true);
    try {
      const data = await api.post('/owner/dev-login', {});
      if (!data.success) return setError(data.message);
      localStorage.setItem('token', data.token);
      localStorage.setItem('owner_user', JSON.stringify(data.owner));
      navigate('/owner/dashboard');
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await api.post('/owner/google-login', { credential: credentialResponse.credential });
      if (!data.success) return setError(data.message);
      localStorage.setItem('token', data.token);
      localStorage.setItem('owner_user', JSON.stringify(data.owner));
      navigate('/owner/dashboard');
    } catch { setError('Google Login Failed.'); }
  };

  return (
    <AuthShell variant="owner" title="Business sign in" subtitle="Manage your shop queue.">

        {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-ink-700 dark:text-ink-300 text-sm font-bold mb-2">Work email</label>
            <input type="email" required className="w-full border border-ink-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white p-2 rounded focus:outline-none focus:border-brand-500" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loggingIn} />
          </div>
          <div>
            <label className="block text-ink-700 dark:text-ink-300 text-sm font-bold mb-2">Password</label>
            <input type="password" required className="w-full border border-ink-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white p-2 rounded focus:outline-none focus:border-brand-500" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loggingIn} />
          </div>
          
          <button
            type="submit"
            disabled={loggingIn}
            className="bg-brand-700 hover:bg-brand-800 text-white font-bold py-2 px-4 rounded mt-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingIn ? 'Logging in...' : 'Sign in'}
          </button>

          {devLoginEnabled && (

          <button 
            type="button" 
            onClick={handleQuickLogin}
            disabled={loggingIn}
            className="bg-ink-200 dark:bg-ink-700 hover:bg-ink-300 dark:hover:bg-ink-600 text-ink-700 dark:text-ink-200 font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingIn ? 'Logging in...' : 'Quick Login (Test Owner)'}
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
            />
          </div>
        </form>

        <div className="mt-4 text-sm text-center flex flex-col gap-2">
          <p className="text-ink-600 dark:text-ink-300">New here? <Link to="/owner/signup" className="text-brand-700 dark:text-brand-400 hover:underline">Register your shop</Link></p>
          <p className="text-ink-500 dark:text-ink-400 text-xs mt-4">Just here to book? <Link to="/login" className="text-brand-700 dark:text-brand-400 hover:underline">Customer login</Link></p>
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