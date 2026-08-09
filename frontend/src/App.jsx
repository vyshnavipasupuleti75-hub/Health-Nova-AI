import { Navigate, Route, Routes } from 'react-router-dom';
import AuthGuard from './routes/AuthGuard';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard/Dashboard';
import Upload from './pages/Upload/Upload';
import Analysis from './pages/Analysis/Analysis';
import Chatbot from './pages/Chatbot/Chatbot';
import Profile from './pages/Profile/Profile';
import Settings from './pages/Settings/Settings';
import ReportHistory from './pages/ReportHistory/ReportHistory';
import ReportDetails from './pages/ReportDetails/ReportDetails';
import SplashScreen from './components/SplashScreen';
import { useAuth } from './auth/AuthContext';

function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const { authLoading, user } = useAuth();
  if (authLoading) return <SplashScreen exiting={authLoading === 'exiting'} />;

  return <Routes>
    <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} /><Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
    <Route element={<AuthGuard />}><Route element={<DashboardLayout />}>
      <Route path="/dashboard" element={<Dashboard />} /><Route path="/home" element={<Home />} />
      <Route path="/upload" element={<Upload />} /><Route path="/analysis" element={<Analysis />} />
      <Route path="/chatbot" element={<Chatbot />} /><Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/history" element={<ReportHistory />} />
      <Route path="/reports/:id" element={<ReportDetails />} />
    </Route></Route><Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
  </Routes>;
}
