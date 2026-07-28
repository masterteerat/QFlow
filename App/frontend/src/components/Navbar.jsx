import { Link, useNavigate } from 'react-router-dom';
import { clearSession } from '../lib/auth';

export default function Navbar({ userName }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
      <Link to="/customer-home" className="text-2xl font-bold text-teal-700 hover:text-teal-800 transition-colors">
        QFlow
      </Link>

      <div className="flex items-center gap-4">
        {userName && <span className="text-slate-600 text-sm font-medium">Hi, {userName}</span>}
        <button
          onClick={handleLogout}
          className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
