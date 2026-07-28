import { BrowserRouter, Routes, Route } from 'react-router-dom';

import CustomerLogin from './pages/CustomerLogin';
import OwnerLogin from './pages/OwnerLogin';
import CustomerSignUp from './pages/CustomerSignUp';
import OwnerSignUp from './pages/OwnerSignUp';
import CustomerHome from './pages/CustomerHome';
import OwnerHome from './pages/OwnerHome';
import MyTickets from './pages/MyTickets';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerLogin />} />
        <Route path="/owner-login" element={<OwnerLogin />} />
        <Route path="/customer-signup" element={<CustomerSignUp />} />
        <Route path="/owner-signup" element={<OwnerSignUp />} />

        <Route path="/customer-home" element={<CustomerHome />} />
        <Route path="/owner-home" element={<OwnerHome />} />
        <Route path="/my-tickets" element={<MyTickets />} />
      </Routes>
    </BrowserRouter>
  );
}
