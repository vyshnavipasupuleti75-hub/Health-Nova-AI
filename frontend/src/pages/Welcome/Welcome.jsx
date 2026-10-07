import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import Logo from '../../components/Logo';
import BrandBackdrop from '../../components/BrandBackdrop';
import { useAuth } from '../../auth/AuthContext';
import '../../styles/splash.css';
import '../../styles/welcome.css';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Same ECG motif as the startup intro, continued faintly behind the mark.
const AMBIENT_ECG = 'M0 60H477l14-5 12 5h40l10-3 8 3h14l8-40 14 82 12-60 8 18h22l18-10 18 10h12l10-4 8 4H1200';

export default function Welcome() {
  const navigate = useNavigate();
  // App only renders routes once the saved session has been checked, so `user` is already final here.
  const { user } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false); // updates synchronously, so rapid repeat clicks are ignored before React re-renders
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const getStarted = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    const destination = user ? '/dashboard' : '/login';
    timer.current = setTimeout(() => navigate(destination), reducedMotion() ? 0 : 280);
  };

  const firstName = user?.name?.split(' ')[0];

  return <main className={`gs${leaving ? ' is-leaving' : ''}`}>
    <BrandBackdrop />
    <section className="gs-content">
      <div className="gs-mark">
        <svg className="gs-ecg" viewBox="0 0 1200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="gs-ecg-base" d={AMBIENT_ECG} />
          <path className="gs-ecg-pulse" d={AMBIENT_ECG} pathLength="1" />
        </svg>
        <Logo compact />
      </div>
      <span className="gs-eyebrow">AI-Powered Healthcare Intelligence</span>
      <h1>Welcome to Health<span>Nova</span></h1>
      <p className="gs-lead">Smarter healthcare.<br />Better understanding.</p>
      <button type="button" className="gs-cta" onClick={getStarted} disabled={leaving} aria-busy={leaving}>
        <span>Get Started</span><FiArrowRight aria-hidden="true" />
      </button>
      <p className="gs-sub">{user
        ? <>Signed in as <b>{firstName || user.email}</b> · you’ll go straight to your dashboard.</>
        : <>New to HealthNova? <Link to="/register">Create an account</Link></>}</p>
    </section>
    <p className="gs-note">Educational insights from your medical reports — not a medical diagnosis.</p>
  </main>;
}
