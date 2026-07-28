import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ userName }) {
  const navigate = useNavigate();

  const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('customer_user');
  localStorage.removeItem('owner_user');
  navigate('/');
};

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 px-8 py-4 flex justify-between items-center">
      <Link to="/customer-home" className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
        QFlow
      </Link>

      <div className="flex items-center gap-4">
        {userName && (
          <span className="text-gray-600 text-sm font-medium">
            Welcome, {userName}!
          </span>
        )}
        <button
          onClick={handleLogout}
          className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
        >
          Log Out
        </button>
      </div>
    </nav>
  );
}