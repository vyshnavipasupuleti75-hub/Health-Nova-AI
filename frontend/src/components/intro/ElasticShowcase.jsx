import { useEffect, useRef, useState } from 'react';
import HealthVisual from '../HealthVisual';
import '../../styles/elasticShowcase.css';

// Login showcase: a calm, interactive version of the elastic HealthNova system (lazy-loaded three.js).
// Wide screens with WebGL get the 3D scene; phones (where the showcase sits below the form) and browsers
// without WebGL keep the lightweight 2D HealthVisual. Reduced motion renders one still 3D frame.
function canUse3d() {
  if (window.innerWidth <= 860) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function ElasticShowcase() {
  const [mode, setMode] = useState(() => (canUse3d() ? '3d' : '2d'));
  const [ready, setReady] = useState(false);
  const hostRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (mode !== '3d') return undefined;
    let cancelled = false;
    let scene = null;
    const canvas = document.createElement('canvas'); // fresh canvas per run (StrictMode-safe)
    canvas.className = 'elastic-canvas';
    hostRef.current.appendChild(canvas);
    import('./elasticScene.js')
      .then(({ createElasticScene }) => createElasticScene(canvas, {
        mode: 'calm',
        lite: window.matchMedia?.('(pointer: coarse)').matches,
        staticFrame: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        onStart: () => { if (!cancelled) setReady(true); },
        onContextLost: () => { if (!cancelled) setMode('2d'); },
      }))
      .then((created) => {
        if (cancelled) { created.dispose(); return; }
        scene = created; sceneRef.current = created; created.start();
      })
      .catch(() => { if (!cancelled) setMode('2d'); });
    return () => { cancelled = true; scene?.dispose(); sceneRef.current = null; canvas.remove(); };
  }, [mode]);

  if (mode === '2d') return <HealthVisual variant="core" />;
  // Decorative: clicking sends a heartbeat through the system.
  return <div ref={hostRef} className={`elastic-showcase${ready ? ' is-ready' : ''}`} aria-hidden="true" onClick={() => sceneRef.current?.pulse()} />;
}
