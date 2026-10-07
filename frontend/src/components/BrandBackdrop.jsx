// Shared navy backdrop for the startup intro and the Get Started screen, so the hand-off between them is seamless.
// A handful of fixed-position particles (no canvas) drift slowly; CSS lives in splash.css.
const PARTICLES = [
  [8, 72, 2, 0], [16, 30, 1.5, -4], [23, 86, 1.5, -9], [31, 18, 2, -2], [39, 64, 1.5, -12], [47, 40, 2.5, -6],
  [55, 82, 1.5, -1], [62, 24, 2, -8], [70, 58, 1.5, -14], [77, 12, 2, -5], [84, 76, 2, -10], [91, 38, 1.5, -3],
  [12, 50, 1.5, -7], [67, 92, 2, -11],
];

export default function BrandBackdrop() {
  return <div className="brand-backdrop" aria-hidden="true">
    <span className="brand-glow" />
    {PARTICLES.map(([left, top, size, delay]) => <i key={`${left}-${top}`} className="brand-particle" style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s` }} />)}
  </div>;
}
