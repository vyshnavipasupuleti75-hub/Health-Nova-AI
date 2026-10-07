import Logo from './Logo';
import BrandBackdrop from './BrandBackdrop';
import '../styles/splash.css';

// Cinematic startup: an ECG trace draws across the screen, collapses into the HealthNova mark,
// then the wordmark and tagline settle in. Used as the no-WebGL / reduced-motion fallback for the 3D intro.
// The ECG's QRS spike sits at x=300, the exact centre of the mark, so the line appears to fold into the logo.
const ECG_PATH = 'M0 60H180l14-5 12 5h40l10-3 8 3h14l8-40 14 82 12-60 8 18h22l18-10 18 10h12l10-4 8 4H600';

export default function SplashScreen({ mode = 'full', exiting = false }) {
  return <div className={`startup startup--${mode}${exiting ? ' is-exiting' : ''}`} role="status" aria-live="polite" aria-label="HealthNova is starting">
    <BrandBackdrop />
    <div className="startup-stage">
      <div className="startup-mark-row">
        <svg className="startup-ecg" viewBox="0 0 600 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <linearGradient id="startup-ecg-fade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#4f9bff" stopOpacity="0" />
              <stop offset=".18" stopColor="#4f9bff" />
              <stop offset=".82" stopColor="#4f9bff" />
              <stop offset="1" stopColor="#4f9bff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="ecg-trace" d={ECG_PATH} pathLength="1" />
          <path className="ecg-pen" d={ECG_PATH} pathLength="1" />
        </svg>
        <span className="startup-ring" aria-hidden="true" />
        <div className="startup-mark"><Logo compact /></div>
      </div>
      <h1 className="startup-word">Health<span>Nova</span></h1>
      <p className="startup-tagline">AI-Powered Healthcare Intelligence</p>
    </div>
  </div>;
}
