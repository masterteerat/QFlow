import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google'; 
import { api } from '../lib/api';

export default function CustomerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const data = await api.post('/customer/login', { email, password });
      if (!data.success) return setError(data.message);

      if (data.token) localStorage.setItem('token', data.token);
      localStorage.setItem('customer_user', JSON.stringify(data.user));
      navigate('/businesses');
    } catch {
      setError('Could not connect to the server.');
    }
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

  const handleQuickLogin = () => {
    setError('');
    
    localStorage.setItem('token', 'bypass-test-token');
    localStorage.setItem('customer_user', JSON.stringify({ 
      id: 1, 
      fname: 'John (Tester)', 
      email: 'john@qflow.com' 
    }));
    
    navigate('/businesses');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-96 transition-colors duration-300">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">Log in to QFlow</h2>

        {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              required
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-bold py-2 px-4 rounded transition-colors mt-2">
            Sign in
          </button>

          <button 
            type="button" 
            onClick={handleQuickLogin}
            className="bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold py-2 px-4 rounded transition-colors"
          >
            🚀 Quick Login (Test Customer)
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
              locale="en"
            />
          </div>
        </form>

        <div className="mt-4 text-sm text-center flex flex-col gap-2">
          <p className="text-slate-700 dark:text-slate-300">
            No account? <Link to="/signup" className="text-teal-700 dark:text-teal-400 hover:underline">Sign up</Link>
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-4">
            Shop owner? <Link to="/owner/login" className="text-teal-700 dark:text-teal-400 hover:underline">Owner login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}