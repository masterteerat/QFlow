import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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

function DarkModeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="fixed bottom-6 right-6 p-3 rounded-full bg-slate-800 dark:bg-amber-400 text-amber-400 dark:text-slate-900 shadow-xl hover:scale-110 transition-transform duration-300 z-50 flex items-center justify-center"
      title="Toggle Dark Mode"
    >
      {isDark ? (
        <svg className="w-6 h-6 animate-[spin_4s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ) : (
        <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      )}
    </button>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <DarkModeToggle />

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