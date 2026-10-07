import { useEffect, useRef } from 'react';
import { FaHeartPulse, FaWandMagicSparkles } from 'react-icons/fa6';
import { FiCheck, FiFileText, FiTrendingUp } from 'react-icons/fi';
import '../styles/healthVisual.css';

// Decorative illustration only: the values shown are a labelled sample, not user data.
const SAMPLE_ROWS = [
  { name: 'Hemoglobin', value: '13.4', unit: 'g/dL', range: '12.0 – 15.5', marker: 42, status: 'ok' },
  { name: 'HbA1c', value: '7.8', unit: '%', range: '4.0 – 5.6', marker: 90, status: 'high' },
  { name: 'LDL', value: '118', unit: 'mg/dL', range: '< 130', marker: 68, status: 'ok' },
  { name: 'TSH', value: '2.1', unit: 'µIU/mL', range: '0.4 – 4.0', marker: 46, status: 'ok' },
];
const ORBIT_INNER = ['CBC', 'Glucose', 'Lipids'];
const ORBIT_OUTER = ['Thyroid', 'Kidney', 'Liver'];
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({ x: (i * 37) % 100, delay: -(i * 1.7) % 11, duration: 9 + (i % 4) * 2.5, size: 2 + (i % 3) }));

// One heartbeat per 100 units; drawn twice as wide as the viewBox so it can scroll seamlessly.
const ECG_PATH = Array.from({ length: 8 }, (_, i) => {
  const x = i * 100;
  return `${i ? 'L' : 'M'}${x} 50 H${x + 30} L${x + 36} 44 L${x + 41} 50 H${x + 47} L${x + 52} 58 L${x + 58} 14 L${x + 64} 80 L${x + 69} 50 H${x + 80} L${x + 88} 42 L${x + 95} 50 H${x + 100}`;
}).join(' ');

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Gentle pointer parallax: one rAF-throttled CSS-variable update, no React re-renders.
function useParallax(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion() || !window.matchMedia?.('(pointer: fine)').matches) return undefined;
    let frame = 0;
    const move = (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        node.style.setProperty('--px', ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        node.style.setProperty('--py', ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, [ref]);
}

function Ecg({ className = '' }) {
  return <div className={`hv-ecg ${className}`} aria-hidden="true">
    <svg viewBox="0 0 400 100" preserveAspectRatio="none">
      <defs><linearGradient id="hv-ecg-stroke" x1="0" x2="1"><stop offset="0" stopColor="#38d6ff" /><stop offset=".55" stopColor="#5b8cff" /><stop offset="1" stopColor="#9b7bff" /></linearGradient></defs>
      <g className="hv-ecg-track"><path d={ECG_PATH} vectorEffect="non-scaling-stroke" /></g>
    </svg>
  </div>;
}

function Particles() {
  return <div className="hv-particles" aria-hidden="true">{PARTICLES.map((p, i) => <i key={i} style={{ '--x': `${p.x}%`, '--delay': `${p.delay}s`, '--duration': `${p.duration}s`, '--size': `${p.size}px` }} />)}</div>;
}

function ScanScene() {
  return <>
    <div className="hv-rings hv-layer-far" aria-hidden="true">
      <svg viewBox="0 0 200 200"><circle className="ring-dashed" cx="100" cy="100" r="92" /><circle className="ring-arc" cx="100" cy="100" r="78" /><circle className="ring-thin" cx="100" cy="100" r="64" /></svg>
    </div>
    <svg className="hv-links hv-layer-mid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path id="hv-link-a" d="M17 9 C 19 12, 24 13.5, 30 14" />
      <path id="hv-link-b" d="M83 12 C 81 13.5, 77 14, 71 14" />
      <path id="hv-link-c" d="M15 82 C 17 76, 22 71, 29 68" />
      {!prefersReducedMotion() && ['a', 'b', 'c'].map((id, i) => <circle key={id} r=".9" className="hv-pulse-dot"><animateMotion dur={`${2.6 + i * .5}s`} begin={`${i * .7}s`} repeatCount="indefinite"><mpath href={`#hv-link-${id}`} /></animateMotion></circle>)}
    </svg>
    <article className="hv-report hv-glass hv-layer-mid" aria-hidden="true">
      <header><span className="hv-report-icon"><FiFileText /></span><div><b>Lab report</b><small>Blood panel</small></div><em>Sample</em></header>
      <ul>{SAMPLE_ROWS.map((row, i) => <li key={row.name} className={row.status} style={{ '--i': i }}>
        <div className="hv-row-head"><span>{row.name}</span><b>{row.value}<small> {row.unit}</small></b></div>
        <div className="hv-row-bar"><div className="hv-range"><i style={{ left: `${row.marker}%` }} /></div><small className="hv-row-ref">{row.range}</small></div>
      </li>)}</ul>
      <footer><span className="hv-analyzing"><i /><i /><i /></span>Reading values against reference ranges</footer>
      <span className="hv-scan-beam" />
    </article>
    <div className="hv-chip hv-glass chip-a hv-layer-near" aria-hidden="true"><span className="dot amber" />HbA1c 7.8% · <b>above range</b></div>
    <div className="hv-chip hv-glass chip-b hv-layer-near" aria-hidden="true"><span className="dot green" /><FiCheck /> Hemoglobin in range</div>
    <div className="hv-chip hv-glass chip-c hv-layer-near" aria-hidden="true"><span className="dot cyan" />Lab ranges matched</div>
    <div className="hv-insight hv-glass hv-layer-near" aria-hidden="true">
      <span className="hv-insight-icon"><FaWandMagicSparkles /></span>
      <div><small>AI insight</small><b>1 of 4 values needs attention</b><span className="hv-meter"><i /></span></div>
    </div>
    <Ecg className="hv-layer-mid" />
  </>;
}

function CoreScene() {
  return <>
    <Ecg className="hv-ecg-core hv-layer-far" />
    <div className="hv-orbit-stage hv-layer-mid" aria-hidden="true">
      <span className="core-ring core-ring-outer" />
      <span className="core-ring core-ring-arc" />
      <span className="core-ring core-ring-inner" />
      <span className="core-heart"><FaHeartPulse /></span>
      {[ORBIT_INNER, ORBIT_OUTER].map((labels, orbit) => <div key={orbit} className={`core-orbit orbit-${orbit}`}>
        {labels.map((label, i) => <span key={label} className="core-node" style={{ '--angle': `${i * 120 + orbit * 60}deg` }}><em>{label}</em></span>)}
      </div>)}
    </div>
    <div className="hv-chip hv-glass core-card-a hv-layer-near" aria-hidden="true"><span className="hv-mini-icon"><FiFileText /></span><div><b>Report received</b><small>PDF · ready to read</small></div></div>
    <div className="hv-chip hv-glass core-card-b hv-layer-near" aria-hidden="true"><span className="hv-mini-icon green"><FiTrendingUp /></span><div><b>Ranges from your lab</b><small>used wherever printed</small></div></div>
  </>;
}

export default function HealthVisual({ variant = 'scan', className = '' }) {
  const ref = useRef(null);
  useParallax(ref);
  return <div ref={ref} className={`hv hv-${variant} ${className}`} role="img" aria-label={variant === 'scan' ? 'Illustration: a sample lab report being read and checked against reference ranges' : 'Illustration: HealthNova AI core connecting health report categories'}>
    <span className="hv-glow" aria-hidden="true" />
    <Particles />
    {variant === 'scan' ? <ScanScene /> : <CoreScene />}
  </div>;
}
