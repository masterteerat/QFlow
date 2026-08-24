import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getOwner } from '../lib/auth';
import Navbar from '../components/Navbar';

export default function OwnerProfile() {
  const navigate = useNavigate();
  const owner = getOwner();
  const [form, setForm] = useState({ fname: '', lname: '', phone_number: '' });
  const [status, setStatus] = useState({ loading: true, error: '', success: '' });

  useEffect(() => {
    if (!owner?.id) return navigate('/owner/login');

    api.get(`/owner/profile/${owner.id}`).then((res) => {
      if (res.success && res.owner) {
        setForm({ fname: res.owner.fname, lname: res.owner.lname, phone_number: res.owner.phone_number || '' });
      }
      setStatus({ loading: false, error: '', success: '' });
    }).catch(() => setStatus({ loading: false, error: 'Could not load profile', success: '' }));
  }, [owner?.id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ ...status, error: '', success: '' });
    try {
      const res = await api.put(`/owner/profile/${owner.id}`, form);
      if (res.success) {
        // อัปเดตข้อมูลที่อยู่ใน Local Storage ด้วย
        localStorage.setItem('owner_user', JSON.stringify(res.owner));
        setStatus({ ...status, success: 'Owner profile updated successfully!' });
      } else setStatus({ ...status, error: res.message });
    } catch {
      setStatus({ ...status, error: 'Server error' });
    }
  };

  if (status.loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading profile...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar userName={form.fname || owner?.fname} profileLink="/owner-profile" />

      <div className="max-w-md mx-auto mt-10 bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Edit Owner Profile</h2>

        {status.error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{status.error}</div>}
        {status.success && <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-3 rounded mb-4 text-sm border border-emerald-200 dark:border-emerald-800">{status.success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">First Name</label>
              <input type="text" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-teal-500 focus:outline-none p-2 rounded" value={form.fname} onChange={(e) => setForm({...form, fname: e.target.value})} required />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
              <input type="text" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-teal-500 focus:outline-none p-2 rounded" value={form.lname} onChange={(e) => setForm({...form, lname: e.target.value})} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
            <input type="tel" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-teal-500 focus:outline-none p-2 rounded" value={form.phone_number} onChange={(e) => setForm({...form, phone_number: e.target.value})} />
          </div>
          <button type="submit" className="mt-4 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}