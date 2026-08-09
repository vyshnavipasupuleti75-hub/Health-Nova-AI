import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
export default function AuthGuard(){ const location=useLocation(); const {user}=useAuth(); return user?<Outlet/>:<Navigate to="/login" state={{from:location}} replace/>; }
