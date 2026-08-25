import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { GoogleLogin } from '@react-oauth/google';
import OTPModal from '../components/OTPModal';

export default function OwnerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

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

  const handleQuickLogin = () => {
    setError('');
    localStorage.setItem('token', 'bypass-test-token');
    localStorage.setItem('owner_user', JSON.stringify({ 
      id: 1, 
      fname: 'John', 
      lname: 'Doe', 
      email: 'john@example.com' 
    }));
    navigate('/owner/dashboard');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-96 transition-colors duration-300">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">QFlow for business</h2>

        {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Work email</label>
            <input type="email" required className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Password</label>
            <input type="password" required className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          
          <button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-4 rounded mt-2 transition-colors">
            Sign in
          </button>

          <button 
            type="button" 
            onClick={handleQuickLogin}
            className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded transition-colors"
          >
            Quick Login (Test Owner)
          </button>
          
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="relative flex items-center py-2 w-full">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-600"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 dark:text-slate-400 text-sm font-medium">Or</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-600"></div>
            </div>

            <GoogleLogin 
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login Failed')}
              useOneTap={false}
            />
          </div>
        </form>

        <div className="mt-4 text-sm text-center flex flex-col gap-2">
          <p className="text-slate-600 dark:text-slate-300">New here? <Link to="/owner/signup" className="text-teal-700 dark:text-teal-400 hover:underline">Register your shop</Link></p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-4">Just here to book? <Link to="/login" className="text-teal-700 dark:text-teal-400 hover:underline">Customer login</Link></p>
        </div>

        <OTPModal
          isOpen={showOTP}
          onClose={() => setShowOTP(false)}
          onVerify={handleVerifyOTP}
          email={otpEmail}
          role="owner"
          onResend={handleResendOTP}
        />
      </div>
    </div>
  );
}