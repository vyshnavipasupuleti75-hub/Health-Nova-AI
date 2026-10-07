import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AuthGuard from './routes/AuthGuard';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import Welcome from './pages/Welcome/Welcome';
import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard/Dashboard';
import Upload from './pages/Upload/Upload';
import Analysis from './pages/Analysis/Analysis';
import Chatbot from './pages/Chatbot/Chatbot';
import Profile from './pages/Profile/Profile';
import Settings from './pages/Settings/Settings';
import ReportHistory from './pages/ReportHistory/ReportHistory';
import ReportDetails from './pages/ReportDetails/ReportDetails';
import CinematicIntro from './components/intro/CinematicIntro';
import RouteLoader from './components/RouteLoader';
import { useAuth } from './auth/AuthContext';

function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

// Startup: the cinematic intro is the entry experience for "/" only. Refreshing an internal route
// (/dashboard, /profile, ...) skips it and renders that route as soon as the saved session is checked.
const INTRO_EXIT_MS = 650;
function useStartupIntro(authLoading) {
  const [playIntro] = useState(() => window.location.pathname === '/');
  const [phase, setPhase] = useState(playIntro ? 'playing' : 'done');
  const [introEnded, setIntroEnded] = useState(false);
  // The intro only leaves once it has ended AND auth is known, so routes never render with an unknown user.
  useEffect(() => {
    if (phase === 'playing' && introEnded && !authLoading) setPhase('exiting');
  }, [phase, introEnded, authLoading]);
  useEffect(() => {
    if (phase !== 'exiting') return undefined;
    const timer = setTimeout(() => setPhase('done'), INTRO_EXIT_MS);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === 'done') delete document.documentElement.dataset.entry; // drop the pre-render navy background
  }, [phase]);
  const endIntro = useCallback(() => setIntroEnded(true), []);
  return { phase, endIntro };
}

// Clicking a HealthNova notification focuses this tab; the service worker then asks the router to open its page.
function useNotificationNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      const url = event.data?.type === 'healthnova:navigate' ? event.data.url : null;
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) navigate(url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
}

export default function App() {
  const { authLoading, user } = useAuth();
  useNotificationNavigation();
  const intro = useStartupIntro(authLoading);
  // Routes mount as the intro starts fading, so the page underneath is revealed by the cross-fade.
  const routesReady = !authLoading && intro.phase !== 'playing';
  const showRouteLoader = authLoading && intro.phase === 'done';

  return <>{routesReady && <Routes>
    <Route path="/" element={<Welcome />} />
    <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} /><Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
    <Route element={<AuthGuard />}><Route element={<DashboardLayout />}>
      <Route path="/dashboard" element={<Dashboard />} /><Route path="/home" element={<Home />} />
      <Route path="/upload" element={<Upload />} /><Route path="/analysis" element={<Analysis />} />
      <Route path="/chatbot" element={<Chatbot />} /><Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/history" element={<ReportHistory />} />
      <Route path="/reports/:id" element={<ReportDetails />} />
    </Route></Route><Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
  </Routes>}
  {intro.phase !== 'done' && <CinematicIntro exiting={intro.phase === 'exiting'} onEnd={intro.endIntro} />}
  {showRouteLoader && <RouteLoader />}
  </>;
}
