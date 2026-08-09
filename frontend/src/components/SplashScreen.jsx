import Logo from './Logo';
import '../styles/splash.css';

export default function SplashScreen({ exiting = false }) {
  return <div className={`splash-screen${exiting ? ' exiting' : ''}`} role="status" aria-label="HealthNova is opening">
    <div className="splash-brand">
      <div className="splash-logo-stage">
        <svg className="startup-signal" viewBox="0 0 240 54" aria-hidden="true">
          <path d="M2 28h69l10-1 7-15 13 34 13-42 13 24h111" />
        </svg>
        <span className="activation-ring ring-one" aria-hidden="true" />
        <span className="activation-ring ring-two" aria-hidden="true" />
        <Logo />
      </div>
      <p>Your Intelligent Health Companion</p>
      <span className="ready-accent" aria-hidden="true" />
    </div>
  </div>;
}
