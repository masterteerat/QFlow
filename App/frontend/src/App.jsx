import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import CustomerLogin from './pages/CustomerLogin';
import OwnerLogin from './pages/OwnerLogin';
import CustomerSignUp from './pages/CustomerSignUp';
import OwnerSignUp from './pages/OwnerSignUp';
import CustomerHome from './pages/CustomerHome';
import OwnerHome from './pages/OwnerHome';
import MyTickets from './pages/MyTickets';
import MySchedule from './pages/MySchedule';
import CustomerProfile from './pages/CustomerProfile';
import OwnerProfile from './pages/OwnerProfile';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';
import ThemeToggle from './components/ThemeToggle';

const PUBLIC_PATHS = ['/login', '/signup', '/owner/login', '/owner/signup'];

// Public pages have no navbar, so they get the floating toggle. Pages with a navbar have it built in.
function PublicThemeToggle() {
  const { pathname } = useLocation();
  return PUBLIC_PATHS.includes(pathname) ? <ThemeToggle floating /> : null;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <PublicThemeToggle />

        <Routes>
        {/* Customer - public */}
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/signup" element={<CustomerSignUp />} />

        {/* Customer - protected */}
        <Route path="/businesses" element={<ProtectedRoute role="customer"><CustomerHome /></ProtectedRoute>} />
        <Route path="/tickets" element={<ProtectedRoute role="customer"><MyTickets /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute role="customer"><MySchedule /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute role="customer"><CustomerProfile /></ProtectedRoute>} />

        {/* Owner - public */}
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner/signup" element={<OwnerSignUp />} />

        {/* Owner - protected */}
        <Route path="/owner/dashboard" element={<ProtectedRoute role="owner"><OwnerHome /></ProtectedRoute>} />
        <Route path="/owner/businesses/:businessId" element={<ProtectedRoute role="owner"><OwnerHome /></ProtectedRoute>} />
        <Route path="/owner/profile" element={<ProtectedRoute role="owner"><OwnerProfile /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/login" replace />} />
        {/* Catch-all for unknown routes - redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </ToastProvider>
);
}