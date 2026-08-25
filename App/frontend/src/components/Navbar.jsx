import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearSession, getCustomer, getOwner } from '../lib/auth';
import { api } from '../lib/api';

export default function Navbar({ userName }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fname: '', lname: '', phone_number: '' });
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  const customer = getCustomer();
  const owner = getOwner();
  const user = customer || owner;
  const role = customer ? 'customer' : 'owner';

  useEffect(() => {
    if (showModal && user?.id) {
      setStatus({ loading: true, error: '', success: '' });
      api.get(`/${role}/profile/${user.id}`).then((res) => {
        if (res.success) {
          const data = res.user || res.owner;
          setForm({ fname: data.fname, lname: data.lname, phone_number: data.phone_number || '' });
        }
        setStatus({ loading: false, error: '', success: '' });
      }).catch(() => setStatus({ loading: false, error: 'Could not load profile', success: '' }));
    }
  }, [showModal, user?.id, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ ...status, error: '', success: '' });
    try {
      const res = await api.put(`/${role}/profile/${user.id}`, {
        fname: form.fname,
        lname: form.lname,
        phone_number: form.phone_number
      });
      if (res.success) {
        const data = res.user || res.owner;
        localStorage.setItem(`${role}_user`, JSON.stringify(data));
        setStatus({ ...status, success: 'Profile updated successfully!' });
        setTimeout(() => setShowModal(false), 1500);
      } else {
        setStatus({ ...status, error: res.message || 'Failed to update profile' });
      }
    } catch (err) {
      console.error('Update profile error:', err);
      setStatus({ ...status, error: 'Server error' });
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  return (
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 flex justify-between items-center relative z-40 transition-colors duration-300">
      <Link to={customer ? "/businesses" : "/owner/dashboard"} className="text-2xl font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors">
        QFlow
      </Link>

      <div className="flex items-center gap-4">
        {userName && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
            title="Edit Profile"
          >
            <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold text-lg">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-slate-600 dark:text-slate-300 text-sm font-bold hidden sm:block">{userName}</span>
          </button>
        )}
        <button onClick={handleLogout} className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-4 py-2 rounded-md text-sm font-semibold transition-colors">
          Log out
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Edit Profile</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6">
              {status.loading ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-8">Loading profile...</div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {status.error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded text-sm font-medium">{status.error}</div>}
                  {status.success && <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-3 rounded text-sm font-medium">{status.success}</div>}

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">First Name</label>
                      <input type="text" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500" value={form.fname} onChange={(e) => setForm({...form, fname: e.target.value})} required />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
                      <input type="text" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500" value={form.lname} onChange={(e) => setForm({...form, lname: e.target.value})} required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                    <input type="tel" className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500" value={form.phone_number} onChange={(e) => setForm({...form, phone_number: e.target.value})} />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold py-2.5 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 bg-teal-700 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-teal-800 transition-colors shadow-sm">
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}