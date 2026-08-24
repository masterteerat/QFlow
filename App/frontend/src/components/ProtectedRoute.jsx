import { Navigate } from 'react-router-dom';
import { getCustomer, getOwner } from '../lib/auth';

/**
 * ห่อ route ที่ต้อง login ก่อนถึงจะเข้าได้
 * role="customer" -> เช็ค customer_user ใน localStorage, ถ้าไม่มีเด้งไป /login
 * role="owner"     -> เช็ค owner_user ใน localStorage, ถ้าไม่มีเด้งไป /owner/login
 */
export default function ProtectedRoute({ role, children }) {
  const user = role === 'owner' ? getOwner() : getCustomer();
  const loginPath = role === 'owner' ? '/owner/login' : '/login';

  if (!user?.id) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
}