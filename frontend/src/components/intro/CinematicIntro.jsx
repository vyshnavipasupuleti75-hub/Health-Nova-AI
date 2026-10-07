import { useCallback, useEffect, useRef, useState } from 'react';
import SplashScreen from '../SplashScreen';
import '../../styles/cinematicIntro.css';

// Entry experience for "/". Picks one of:
//   '3d'       – the elastic three.js scene (lazy-loaded chunk), lighter scene on phones / low-end devices
//   'static3d' – prefers-reduced-motion: the settled 3D composition as one still frame, then a short fade
//   'fallback' – the 2D ECG brand animation when WebGL is unavailable or the 3D scene fails to start
const FALLBACK_MS = 3500;
const STATIC_MS = 1400;
const BRAND = 'HealthNova';
const START_WATCHDOG_MS = 6000;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
const isLiteDevice = () => window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 820
  || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

export default function CinematicIntro({ exiting = false, onEnd }) {
  const [mode, setMode] = useState(() => (webglAvailable() ? (prefersReducedMotion() ? 'static3d' : '3d') : 'fallback'));
  const [started, setStarted] = useState(false);
  const stageRef = useRef(null);
  const rootRef = useRef(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const endedRef = useRef(false);
  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEndRef.current?.();
  }, []);

  useEffect(() => {
    if (mode === '3d') return undefined;
    const timer = setTimeout(finish, mode === 'static3d' ? STATIC_MS : FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [mode, finish]);

  useEffect(() => {
    if (mode !== '3d' && mode !== 'static3d') return undefined;
    const staticFrame = mode === 'static3d';
    let cancelled = false;
    let intro = null;
    let didStart = false;
    // A fresh canvas per effect run, so a disposed scene can never take down a live WebGL context.
    const canvas = document.createElement('canvas');
    canvas.className = 'ci-canvas';
    stageRef.current.appendChild(canvas);
    const watchdog = setTimeout(() => { if (!cancelled && !didStart) setMode('fallback'); }, START_WATCHDOG_MS);
    import('./elasticScene.js')
      .then(({ createElasticScene }) => createElasticScene(canvas, {
        mode: 'intro',
        lite: isLiteDevice(),
        staticFrame,
        onStart: () => { didStart = true; setStarted(true); if (staticFrame) rootRef.current?.classList.add('phase-brand'); },
        // Scene beats drive the DOM layers (brand reveal, dive bloom) so they stay in sync with the physics.
        onPhase: (phase) => rootRef.current?.classList.add(`phase-${phase}`),
        onEnd: finish,
        onContextLost: finish,
      }))
      .then((scene) => {
        if (cancelled) { scene.dispose(); return; }
        intro = scene;
        scene.start();
      })
      .catch(() => { if (!cancelled) setMode('fallback'); });
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      intro?.dispose();
      canvas.remove();
    };
  }, [mode, finish]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  if (mode === 'fallback') return <SplashScreen mode="full" exiting={exiting} />;

  return <div ref={rootRef} className={`ci${started ? ' is-started' : ''}${exiting ? ' is-exiting' : ''}${mode === 'static3d' ? ' is-static' : ''}`} role="region" aria-label="HealthNova introduction">
    <div ref={stageRef} className="ci-stage" aria-hidden="true" />
    <div className="ci-vignette" aria-hidden="true" />
    <div className="ci-brand">
      <h1 aria-label={BRAND}>{[...BRAND].map((letter, i) => <span key={i} aria-hidden="true" className={`ci-letter${i >= 6 ? ' is-accent' : ''}`} style={{ '--i': i }}>{letter}</span>)}</h1>
      <p>AI-Powered Healthcare Intelligence</p>
    </div>
    <div className="ci-flash" aria-hidden="true" />
    <p className="ci-caption" aria-hidden="true">Sample visuals · not your health data</p>
    {mode === '3d' && <button type="button" className="ci-skip" onClick={finish}>Skip intro</button>}
  </div>;
}
