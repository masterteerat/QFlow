import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { GoogleLogin } from '@react-oauth/google';

export default function OwnerSignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fname: '', lname: '', phone_number: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const data = await api.post('/owner/signup', form);
      if (data.success) return navigate('/owner/login');
      setError(data.message);
    } catch {
      setError('Could not connect to the server.');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await api.post('/owner/google-login', { credential: credentialResponse.credential });
      if (!data.success) return setError(data.message);
      localStorage.setItem('token', data.token);
      localStorage.setItem('owner_user', JSON.stringify(data.owner));
      navigate('/owner/home');
    } catch { setError('Google Login Failed.'); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center py-10 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-full max-w-md transition-colors duration-300">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">Register your shop</h2>

        {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">First name</label>
              <input type="text" name="fname" required className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500" value={form.fname} onChange={handleChange} />
            </div>
            <div className="flex-1">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Last name</label>
              <input type="text" name="lname" required className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500" value={form.lname} onChange={handleChange} />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Contact phone <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
            <input type="tel" name="phone_number" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500" value={form.phone_number} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Work email</label>
            <input type="email" name="email" required className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500" value={form.email} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Password</label>
            <input type="password" name="password" required className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500" value={form.password} onChange={handleChange} />
          </div>

          <button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-4 rounded mt-4 transition-colors">
            Register
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

        <p className="mt-4 text-sm text-center text-slate-600 dark:text-slate-300">
          Already registered? <Link to="/owner-login" className="text-teal-700 dark:text-teal-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}