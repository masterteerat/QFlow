import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">QFlow</h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-300 text-sm">
            {user?.fname} {user?.lname} ({user?.role})
          </span>
          <button onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition">
            Logout
          </button>
        </div>
      </nav>
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome, {user?.fname}!</h2>
          <p className="text-slate-400">You are logged in as a {user?.role}.</p>
        </div>
      </div>
    </div>
  );
}
