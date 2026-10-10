import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { clearSession, getCustomer, getOwner, getTokenRole } from '../lib/auth';
import { api } from '../lib/api';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

const ICON = {
  explore: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />,
  tickets: <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 010-4h18a2 2 0 010 4v0a2 2 0 000 6v0a2 2 0 010 4H3a2 2 0 010-4v0a2 2 0 000-6zM13 5v14" />,
  schedule: <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
};

const CUSTOMER_TABS = [
  { to: '/businesses', label: 'Explore', icon: 'explore' },
  { to: '/tickets', label: 'Tickets', icon: 'tickets' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' }
];

const Icon = ({ name, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">{ICON[name]}</svg>
);

export default function Navbar({ userName }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fname: '', lname: '', phone_number: '' });
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  const customer = getCustomer();
  const owner = getOwner();
  // FIX: pick the role from the login token, not from whichever user happens to be in localStorage.
  // Before, logging in as owner while an old customer session was stored showed the customer's menu
  // and sent profile requests to the wrong endpoint.
  const tokenRole = getTokenRole();
  const role = tokenRole || (customer ? 'customer' : 'owner');
  const user = role === 'customer' ? customer : owner;

  // Phones get a fixed bottom tab bar for customers; this adds space under the page so nothing hides behind it.
  useEffect(() => {
    if (role !== 'customer') return undefined;
    document.body.classList.add('has-tabbar');
    return () => document.body.classList.remove('has-tabbar');
  }, [role]);

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
    setStatus((st) => ({ ...st, error: '', success: '' }));
    try {
      const res = await api.put(`/${role}/profile/${user.id}`, {
        fname: form.fname,
        lname: form.lname,
        phone_number: form.phone_number
      });
      if (res.success) {
        const data = res.user || res.owner;
        localStorage.setItem(`${role}_user`, JSON.stringify(data));
        setStatus((st) => ({ ...st, success: 'Profile updated successfully!' }));
        setTimeout(() => setShowModal(false), 1500);
      } else {
        setStatus((st) => ({ ...st, error: res.message || 'Failed to update profile' }));
      }
    } catch (err) {
      console.error('Update profile error:', err);
      setStatus((st) => ({ ...st, error: 'Server error' }));
    }
  };

  const handleLogout = async () => {
    await api.post('/logout').catch(() => {}); // revoke the token on the server first
    clearSession();
    navigate('/');
  };

  const inputCls = 'w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-700 dark:text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

  return (
    <>
      <header className="sticky top-0 z-40 bg-ink-50/85 dark:bg-ink-900/85 backdrop-blur-md border-b border-ink-200/80 dark:border-ink-700/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2">
          <Link to={role === 'customer' ? '/businesses' : '/owner/dashboard'} aria-label="QFlow home">
            <Logo />
          </Link>

          {role === 'customer' && (
            <nav className="hidden sm:flex items-center gap-1 ml-6 p-1 rounded-full bg-ink-100 dark:bg-ink-800" aria-label="Main">
              {CUSTOMER_TABS.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-white dark:bg-ink-700 text-brand-700 dark:text-brand-300 shadow-sm'
                        : 'text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon name={t.icon} className="w-4 h-4" />
                  {t.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {userName && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2.5 pl-1 pr-1 sm:pr-3.5 py-1 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 hover:border-brand-400"
                title="Profile"
                aria-label="Open profile"
              >
                <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:block text-sm font-bold text-ink-800 dark:text-ink-100">{userName}</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className={`${role === 'customer' ? 'hidden sm:block' : ''} text-sm font-bold text-ink-600 dark:text-ink-300 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-2 rounded-full`}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {role === 'customer' && (
        <nav
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-ink-800/95 backdrop-blur-md border-t border-ink-200 dark:border-ink-700 grid grid-cols-3 px-2 pt-1.5"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          aria-label="Main"
        >
          {CUSTOMER_TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] font-bold ${
                  isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ink-500 dark:text-ink-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`px-5 py-1 rounded-full transition-colors ${isActive ? 'bg-brand-100 dark:bg-brand-900/60' : ''}`}>
                    <Icon name={t.icon} />
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-ink-800 rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-lg">
                  {(userName || '?').charAt(0).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-ink-900 dark:text-white leading-tight">Your profile</h2>
                  <p className="text-xs text-ink-500 dark:text-ink-400 capitalize">{role} account</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} aria-label="Close" className="w-9 h-9 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-200 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 pb-6 pt-2">
              {status.loading ? (
                <div className="text-center text-ink-500 dark:text-ink-400 py-8">Loading profile...</div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {status.error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded-xl text-sm font-medium">{status.error}</div>}
                  {status.success && <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl text-sm font-medium">{status.success}</div>}

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-1.5">First name</label>
                      <input type="text" className={inputCls} value={form.fname} onChange={(e) => setForm({ ...form, fname: e.target.value })} required />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-1.5">Last name</label>
                      <input type="text" className={inputCls} value={form.lname} onChange={(e) => setForm({ ...form, lname: e.target.value })} required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-1.5">Phone number</label>
                    <input type="tel" className={inputCls} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
                  </div>

                  <div className="flex gap-3 mt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-200 font-bold py-3 rounded-xl hover:bg-ink-200 dark:hover:bg-ink-600">
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 bg-brand-700 text-white font-bold py-3 rounded-xl hover:bg-brand-800 shadow-sm">
                      Save changes
                    </button>
                  </div>

                  <button type="button" onClick={handleLogout} className="mt-1 py-3 rounded-xl text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40">
                    Log out
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
