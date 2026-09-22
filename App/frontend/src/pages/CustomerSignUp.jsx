import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { GoogleLogin } from '@react-oauth/google';

const NAME_REGEX = /^[A-Za-zก-๙'\- ]+$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{8,9}$/; // 0XXXXXXXX(X) - 9 or 10 digits, starts with 0
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validateField(name, value) {
  switch (name) {
    case 'fname':
    case 'lname':
      if (!value.trim()) return 'This field is required.';
      if (!NAME_REGEX.test(value.trim())) return 'Letters only.';
      return '';
    case 'phone_number':
      if (!value) return ''; // optional field
      if (!PHONE_REGEX.test(value)) return 'Invalid phone number (9-10 digits, starting with 0).';
      return '';
    case 'email':
      if (!value.trim()) return 'Email is required.';
      if (!EMAIL_REGEX.test(value.trim())) return 'Invalid email format.';
      return '';
    case 'password':
      if (!value) return 'Password is required.';
      if (!PASSWORD_REGEX.test(value)) return 'At least 8 characters, with uppercase, lowercase, and a number.';
      return '';
    default:
      return '';
  }
}

export default function CustomerSignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fname: '', lname: '', phone_number: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const cleanValue = name === 'phone_number' ? value.replace(/\D/g, '') : value;
    setForm((prev) => ({ ...prev, [name]: cleanValue }));
    setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, cleanValue) }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = {};
    Object.keys(form).forEach((key) => {
      const msg = validateField(key, form[key]);
      if (msg) errors[key] = msg;
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const data = await api.post('/customer/signup', form);
      if (data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      setError(data.message);
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await api.post('/customer/google-login', { credential: credentialResponse.credential });
      if (!data.success) return setError(data.message);
      localStorage.setItem('token', data.token);
      localStorage.setItem('customer_user', JSON.stringify(data.user));
      navigate('/businesses');
    } catch { setError('Google Login Failed.'); }
  };

  const inputClass = (name) =>
    `w-full border ${fieldErrors[name] ? 'border-rose-400 dark:border-rose-500' : 'border-slate-300 dark:border-slate-600'} dark:bg-slate-700 dark:text-white p-2 rounded focus:outline-none focus:border-teal-500`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center py-10 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-full max-w-md transition-colors duration-300">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">Create your account</h2>

        {error && <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded mb-4 text-sm border border-rose-200 dark:border-rose-800">{error}</div>}
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-3 rounded mb-4 text-sm border border-emerald-200 dark:border-emerald-800 text-center">
            Account created successfully! Redirecting to sign in...
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">First name</label>
              <input type="text" name="fname" required className={inputClass('fname')} value={form.fname} onChange={handleChange} onBlur={handleBlur} disabled={submitting || success} />
              {fieldErrors.fname && <p className="text-rose-500 text-xs mt-1">{fieldErrors.fname}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Last name</label>
              <input type="text" name="lname" required className={inputClass('lname')} value={form.lname} onChange={handleChange} onBlur={handleBlur} disabled={submitting || success} />
              {fieldErrors.lname && <p className="text-rose-500 text-xs mt-1">{fieldErrors.lname}</p>}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Phone <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
            <input type="tel" inputMode="numeric" name="phone_number" className={inputClass('phone_number')} value={form.phone_number} onChange={handleChange} onBlur={handleBlur} maxLength={10} disabled={submitting || success} />
            {fieldErrors.phone_number && <p className="text-rose-500 text-xs mt-1">{fieldErrors.phone_number}</p>}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Email</label>
            <input type="email" name="email" required className={inputClass('email')} value={form.email} onChange={handleChange} onBlur={handleBlur} disabled={submitting || success} />
            {fieldErrors.email && <p className="text-rose-500 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">Password</label>
            <input type="password" name="password" required className={inputClass('password')} value={form.password} onChange={handleChange} onBlur={handleBlur} disabled={submitting || success} />
            {fieldErrors.password ? (
              <p className="text-rose-500 text-xs mt-1">{fieldErrors.password}</p>
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">At least 8 characters, with uppercase, lowercase, and a number.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || success}
            className="bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-bold py-2 px-4 rounded mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating account...' : 'Create account'}
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

        <p className="mt-4 text-sm text-center text-slate-700 dark:text-slate-300">
          Already have an account? <Link to="/login" className="text-teal-700 dark:text-teal-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}