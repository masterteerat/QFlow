import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

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
      if (data.success) return navigate('/owner-login');
      setError(data.message);
    } catch {
      setError('Could not connect to the server.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center py-10">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Register your shop</h2>

        {error && <div className="bg-rose-50 text-rose-700 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-slate-700 text-sm font-bold mb-2">First name</label>
              <input type="text" name="fname" required className="w-full border border-slate-300 p-2 rounded" value={form.fname} onChange={handleChange} />
            </div>
            <div className="flex-1">
              <label className="block text-slate-700 text-sm font-bold mb-2">Last name</label>
              <input type="text" name="lname" required className="w-full border border-slate-300 p-2 rounded" value={form.lname} onChange={handleChange} />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-bold mb-2">Contact phone <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="tel" name="phone_number" className="w-full border border-slate-300 p-2 rounded" value={form.phone_number} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-bold mb-2">Work email</label>
            <input type="email" name="email" required className="w-full border border-slate-300 p-2 rounded" value={form.email} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-bold mb-2">Password</label>
            <input type="password" name="password" required className="w-full border border-slate-300 p-2 rounded" value={form.password} onChange={handleChange} />
          </div>

          <button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 px-4 rounded mt-4 transition-colors">
            Register
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          Already registered? <Link to="/owner-login" className="text-teal-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
