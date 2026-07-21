import { BrowserRouter, Routes, Route } from 'react-router-dom';

import CustomerLogin from './pages/CustomerLogin';
import OwnerLogin from './pages/OwnerLogin';
import CustomerSignUp from './pages/CustomerSignUp';
import OwnerSignUp from './pages/OwnerSignUp';
import CustomerHome from './pages/CustomerHome';
import OwnerHome from './pages/OwnerHome';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<CustomerLogin />} />
        <Route path="/owner-login" element={<OwnerLogin />} />
        <Route path="/customer-signup" element={<CustomerSignUp />} />
        <Route path="/owner-signup" element={<OwnerSignUp />} />

        {/* Dashboard/Home Routes */}
        <Route path="/customer-home" element={<CustomerHome />} />
        <Route path="/owner-home" element={<OwnerHome />} />
      </Routes>
    </BrowserRouter>
  );
}