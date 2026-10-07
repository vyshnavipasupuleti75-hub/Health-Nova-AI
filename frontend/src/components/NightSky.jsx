import '../styles/nightSky.css';

// Small seeded generator so the sky looks the same on every render and page load.
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

// Distant star fields drawn as box-shadows on a single 1px element per layer (cheap to composite).
function starField(count, seed, maxOpacity) {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    const x = Math.round(random() * 2560);
    const y = Math.round(random() * 1600);
    const alpha = (0.25 + random() * maxOpacity).toFixed(2);
    return `${x}px ${y}px rgba(220,232,255,${alpha})`;
  }).join(',');
}

const FAR_LAYER = starField(220, 7, 0.45);
const NEAR_LAYER = starField(90, 31, 0.6);

// Brighter twinkling stars with staggered timing so they never pulse together.
const TWINKLES = (() => {
  const random = seeded(97);
  return Array.from({ length: 46 }, (_, index) => {
    const size = 1.2 + random() * 1.6;
    return {
      key: index,
      style: {
        left: `${(random() * 100).toFixed(2)}%`,
        top: `${(random() * 100).toFixed(2)}%`,
        width: `${size.toFixed(1)}px`,
        height: `${size.toFixed(1)}px`,
        animationDuration: `${(3.5 + random() * 5).toFixed(1)}s`,
        animationDelay: `-${(random() * 8).toFixed(1)}s`,
      },
      glow: random() > 0.72,
    };
  });
})();

export default function NightSky() {
  return <div className="night-sky" aria-hidden="true">
    <div className="night-sky-nebula" />
    <div className="night-sky-layer far" style={{ boxShadow: FAR_LAYER }} />
    <div className="night-sky-layer near" style={{ boxShadow: NEAR_LAYER }} />
    {TWINKLES.map(({ key, style, glow }) => <span key={key} className={`night-star${glow ? ' glow' : ''}`} style={style} />)}
  </div>;
}
