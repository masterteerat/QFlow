import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function OwnerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const data = await api.post('/owner/login', { email, password });
      if (!data.success) return setError(data.message);

      if (data.token) localStorage.setItem('token', data.token);
      localStorage.setItem('owner_user', JSON.stringify(data.owner));
      navigate('/owner-home');
    } catch {
      setError('Could not connect to the server.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-sm w-96">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">QFlow for business</h2>

        {error && <div className="bg-rose-50 text-rose-700 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-slate-700 text-sm font-bold mb-2">Work email</label>
            <input type="email" required className="w-full border border-slate-300 p-2 rounded" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-bold mb-2">Password</label>
            <input type="password" required className="w-full border border-slate-300 p-2 rounded" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-4 rounded mt-2 transition-colors">
            Sign in
          </button>
        </form>

        <div className="mt-4 text-sm text-center flex flex-col gap-2">
          <p>New here? <Link to="/owner-signup" className="text-teal-700 hover:underline">Register your shop</Link></p>
          <p className="text-slate-500 text-xs mt-4">Just here to book? <Link to="/" className="text-teal-700 hover:underline">Customer login</Link></p>
        </div>
      </div>
    </div>
  );
}
