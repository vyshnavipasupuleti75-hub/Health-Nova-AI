// HealthNova "elastic medical intelligence" scene (plain three.js + a tiny spring solver).
// Nothing here is keyframed: every moving thing is a damped spring that is given targets or velocity kicks
// by a small event schedule, so overshoot, squash/stretch, inertia and settling all come from the physics.
//
//  mode 'intro' – the entry experience: particle → elastic ECG ribbon → logo impact → nodes → cards →
//                 lub-dub heartbeat through the whole system → brand → camera dives into the logo.
//  mode 'calm'  – the Login showcase: the settled system, breathing, reacting to the pointer and to clicks.
//  staticFrame  – prefers-reduced-motion: the settled composition rendered once, no motion at all.
import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture,
  ClampToEdgeWrapping, DirectionalLight, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, FogExp2, Group,
  IcosahedronGeometry, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, PointLight, Points, PointsMaterial, RingGeometry, Scene, Shape, SRGBColorSpace, Sprite,
  SpriteMaterial, Vector3, WebGLRenderer,
} from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { Spring, Spring3 } from '../../utils/spring.js';

export const INTRO_DURATION = 7.4;

// Font Awesome 6 "heart-pulse" — the icon inside the HealthNova <Logo/> (react-icons FaHeartPulse).
const HEART_PULSE_PATH = 'M228.3 469.1L47.6 300.4c-4.2-3.9-8.2-8.1-11.9-12.4l87 0c22.6 0 43-13.6 51.7-34.5l10.5-25.2 49.3 109.5c3.8 8.5 12.1 14 21.4 14.1s17.8-5 22-13.3L320 253.7l1.7 3.4c9.5 19 28.9 31 50.1 31l104.5 0c-3.7 4.3-7.7 8.5-11.9 12.4L283.7 469.1c-7.5 7-17.4 10.9-27.7 10.9s-20.2-3.9-27.7-10.9zM503.7 240l-132 0c-3 0-5.8-1.7-7.2-4.4l-23.2-46.3c-4.1-8.1-12.4-13.3-21.5-13.3s-17.4 5.1-21.5 13.3l-41.4 82.8L205.9 158.2c-3.9-8.7-12.7-14.3-22.2-14.1s-18.1 5.9-21.8 14.8l-31.8 76.3c-1.2 3-4.2 4.9-7.4 4.9L16 240c-2.6 0-5 .4-7.3 1.1C3 225.2 0 208.2 0 190.9l0-5.8c0-69.9 50.5-129.5 119.4-141C165 36.5 211.4 51.4 244 84l12 12 12-12c32.6-32.6 79-47.5 124.6-39.9C461.5 55.6 512 115.2 512 185.1l0 5.8c0 16.9-2.8 33.5-8.3 49.1z';

// Decorative report-category nodes (no values) and status cards (no medical data, no accuracy claims).
const NODES = [
  { label: 'CBC', sub: 'Blood count', pos: [0, 2.85, -1.0] },
  { label: 'Thyroid', sub: 'TSH · T4', pos: [3.75, 0.55, -0.5] },
  { label: 'Glucose', sub: 'Sugar · HbA1c', pos: [2.45, -2.35, 0.3] },
  { label: 'Liver', sub: 'Liver panel', pos: [-2.45, -2.35, 0.1] },
  { label: 'Kidney', sub: 'Renal panel', pos: [-3.75, 0.55, -0.6] },
  { label: 'Lipids', sub: 'Cholesterol', pos: [-2.3, 2.4, -2.2] },
];
const CARDS = [
  { title: 'REPORT RECEIVED', text: 'PDF successfully uploaded', icon: 'doc', pos: [4.85, 2.5, -1.8], ry: -0.34 },
  { title: 'AI INSIGHT', text: 'Report organized', icon: 'spark', pos: [-5.55, -1.25, -0.8], ry: 0.36 },
  { title: 'ANALYSIS READY', text: 'Health information processed', icon: 'check', pos: [4.75, -2.45, 0.2], ry: -0.26 },
];
const PORTRAIT_CARDS = [[0, 5.05, -1.4], [0, -5.0, -0.6]];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, x) => a + (b - a) * x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTexture(canvas) { const t = new CanvasTexture(canvas); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const FONT = '"Plus Jakarta Sans", Inter, system-ui, "Segoe UI", sans-serif';

function glowTexture() {
  const c = makeCanvas(128, 128); const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.45)'); gr.addColorStop(0.55, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return canvasTexture(c);
}
function logoGradientTexture() {
  const c = makeCanvas(256, 256); const g = c.getContext('2d');
  const lin = g.createLinearGradient(0, 0, 256, 256); lin.addColorStop(0, '#4c9dff'); lin.addColorStop(0.5, '#1769e8'); lin.addColorStop(1, '#0b3fb0');
  g.fillStyle = lin; g.fillRect(0, 0, 256, 256);
  const hi = g.createRadialGradient(70, 60, 0, 70, 60, 150); hi.addColorStop(0, 'rgba(255,255,255,.22)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi; g.fillRect(0, 0, 256, 256);
  const t = canvasTexture(c); t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping; t.repeat.set(0.5, 0.5); t.offset.set(0.5, 0.5); // extrude cap UVs are -1..1
  return t;
}
function labelTexture(label, sub) {
  const c = makeCanvas(512, 168); const g = c.getContext('2d');
  roundRect(g, 6, 6, 500, 156, 62);
  const fill = g.createLinearGradient(0, 0, 512, 168); fill.addColorStop(0, 'rgba(36,74,160,.72)'); fill.addColorStop(1, 'rgba(10,22,58,.82)');
  g.fillStyle = fill; g.fill(); g.strokeStyle = 'rgba(150,205,255,.6)'; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.arc(70, 84, 16, 0, Math.PI * 2); g.fillStyle = '#6fe0ff'; g.shadowColor = '#6fe0ff'; g.shadowBlur = 18; g.fill(); g.shadowBlur = 0;
  g.fillStyle = '#ffffff'; g.font = `800 54px ${FONT}`; g.fillText(label, 106, 84);
  g.fillStyle = '#a9c8f2'; g.font = `600 30px ${FONT}`; g.fillText(sub, 108, 128);
  return canvasTexture(c);
}
function cardTexture({ title, text, icon }) {
  const W = 896; const H = 384; const c = makeCanvas(W, H); const g = c.getContext('2d');
  roundRect(g, 6, 6, W - 12, H - 12, 46);
  const fill = g.createLinearGradient(0, 0, W, H); fill.addColorStop(0, 'rgba(74,132,236,.40)'); fill.addColorStop(0.5, 'rgba(22,46,108,.58)'); fill.addColorStop(1, 'rgba(10,20,54,.70)');
  g.fillStyle = fill; g.fill();
  g.save(); g.clip(); const sheen = g.createLinearGradient(0, 0, 0, H * 0.55); sheen.addColorStop(0, 'rgba(255,255,255,.16)'); sheen.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sheen; g.fillRect(0, 0, W, H * 0.55); g.restore();
  const border = g.createLinearGradient(0, 0, W, H); border.addColorStop(0, 'rgba(200,230,255,.9)'); border.addColorStop(0.5, 'rgba(110,170,255,.35)'); border.addColorStop(1, 'rgba(160,130,255,.5)');
  g.strokeStyle = border; g.lineWidth = 3; g.stroke();
  const cx = 116; const cy = H / 2;
  const disc = g.createLinearGradient(cx - 60, cy - 60, cx + 60, cy + 60); disc.addColorStop(0, '#6fe0ff'); disc.addColorStop(1, '#2563eb');
  g.beginPath(); g.arc(cx, cy, 60, 0, Math.PI * 2); g.fillStyle = disc; g.shadowColor = 'rgba(80,190,255,.8)'; g.shadowBlur = 24; g.fill(); g.shadowBlur = 0;
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  if (icon === 'doc') { roundRect(g, cx - 22, cy - 30, 44, 60, 8); g.stroke(); g.beginPath(); g.moveTo(cx - 11, cy - 6); g.lineTo(cx + 11, cy - 6); g.moveTo(cx - 11, cy + 9); g.lineTo(cx + 7, cy + 9); g.stroke(); }
  else if (icon === 'spark') { g.beginPath(); for (let i = 0; i < 8; i += 1) { const a = (i * Math.PI) / 4 - Math.PI / 2; const r = i % 2 ? 11 : 32; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(cx - 24, cy + 2); g.lineTo(cx - 6, cy + 20); g.lineTo(cx + 26, cy - 16); g.stroke(); }
  if ('letterSpacing' in g) g.letterSpacing = '5px';
  g.fillStyle = '#8fdcff'; g.font = `800 30px ${FONT}`; g.fillText(title, 214, 164);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.fillStyle = '#ffffff'; g.font = `700 42px ${FONT}`; g.fillText(text, 214, 228);
  return canvasTexture(c);
}
function sheenTexture() {
  const c = makeCanvas(256, 8); const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.46, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(210,235,255,.5)'); gr.addColorStop(0.56, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 8);
  const t = canvasTexture(c); t.wrapS = ClampToEdgeWrapping; return t;
}

function ecgY(x) {
  let y = 0;
  for (const [c, a] of [[-7.6, 0.55], [-3.8, 0.8], [0, 1.25], [3.8, 0.8], [7.6, 0.55]]) {
    const g = (center, w) => Math.exp(-(((x - center) / w) ** 2));
    y += a * (0.13 * g(c - 0.8, 0.2) - 0.16 * g(c - 0.2, 0.08) + g(c, 0.1) - 0.36 * g(c + 0.2, 0.09) + 0.26 * g(c + 0.78, 0.26));
  }
  return y;
}

export async function createElasticScene(canvas, { mode = 'intro', lite = false, staticFrame = false, onStart, onEnd, onPhase, onContextLost } = {}) {
  const calm = mode === 'calm';
  if (document.fonts?.load) await Promise.race([document.fonts.load(`800 40px ${FONT}`), new Promise((r) => setTimeout(r, 700))]).catch(() => {});

  const size = () => [Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight)];
  const [w0, h0] = size();
  const renderer = new WebGLRenderer({ canvas, antialias: !lite, alpha: calm, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75));
  renderer.setSize(w0, h0, false);
  renderer.setClearColor('#040814', calm ? 0 : 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  const portrait = w0 / h0 < 0.8;
  const scene = new Scene();
  scene.fog = new FogExp2(calm ? '#071330' : '#040814', calm ? 0.028 : 0.036);
  const camera = new PerspectiveCamera(portrait ? 52 : 40, w0 / h0, 0.1, 140);
  const baseFov = camera.fov;
  const random = seeded(7);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const glow = keep(glowTexture());
  const additive = (color, opacity = 0) => keep(new SpriteMaterial({ map: glow, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }));
  const springs = [];
  const spring = (v, o) => { const s = new Spring(v, o); springs.push(s); return s; };
  const spring3 = (v, o) => { const s = new Spring3(v, o); springs.push(s); return s; };

  // ---------- Light ----------
  scene.add(new AmbientLight('#4a5f9a', 0.75));
  const key = new DirectionalLight('#e3edff', 2.2); key.position.set(-3, 4, 6); scene.add(key);
  const cyan = new PointLight('#38d7ff', 3.2, 0, 0); cyan.position.set(3.5, 1.5, 3.5); scene.add(cyan);
  const violet = new PointLight('#7a5cff', 1.4, 0, 0); violet.position.set(-4, -2.5, 2); scene.add(violet);
  const core = new PointLight('#5aa8ff', 0, 0, 0); core.position.set(0, 0.2, 2.2); scene.add(core);
  const coreFlash = spring(0, { stiffness: 30, damping: 9 });

  // ---------- Atmosphere & dust ----------
  const atmosphere = [['#1d4fd8', [0, 0, -18], 46, 0.5], ['#6d4bd8', [-13, 6, -22], 30, 0.2], ['#16a3d8', [14, -5, -20], 28, 0.17]].map(([color, pos, scale, max]) => {
    const s = new Sprite(additive(color)); s.position.fromArray(pos); s.scale.setScalar(scale); s.material.fog = false; scene.add(s); return { s, max };
  });
  const dustCount = lite ? 260 : 700;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) { dustPos[i * 3] = (random() - 0.5) * 44; dustPos[i * 3 + 1] = (random() - 0.5) * 24; dustPos[i * 3 + 2] = -42 + random() * 48; }
  const dustGeo = keep(new BufferGeometry()); dustGeo.setAttribute('position', new Float32BufferAttribute(dustPos, 3));
  const dustMat = keep(new PointsMaterial({ map: glow, color: '#9cc9ff', size: 0.085, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
  const dust = new Points(dustGeo, dustMat); scene.add(dust);

  // ---------- Elastic ECG ribbon: a chain of spring-connected points ----------
  const N = lite ? 170 : 300;
  const squash = portrait ? 0.5 : 1;
  const rest = new Float32Array(N * 3); const pos = new Float32Array(N * 3); const vel = new Float32Array(N * 3); const pulseY = new Float32Array(N);
  const xs = new Float32Array(N);
  for (let i = 0; i < N; i += 1) {
    const xu = -11 + (22 * i) / (N - 1); xs[i] = xu;
    rest[i * 3] = xu * squash; rest[i * 3 + 1] = ecgY(xu) - 0.15; rest[i * 3 + 2] = -(xu * xu) / 26 - 0.4;
  }
  const ribbonIndex = [];
  for (let i = 0; i < N - 1; i += 1) { const a = i * 2; ribbonIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const glowIndex = [];
  for (let i = 0; i < N - 1; i += 1) for (let col = 0; col < 2; col += 1) { const a = i * 3 + col; glowIndex.push(a, a + 1, a + 3, a + 1, a + 4, a + 3); }
  const makeRibbon = (opacity, columns) => {
    const geo = keep(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * columns * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(N * columns * 4), 4));
    geo.setIndex(columns === 3 ? glowIndex : ribbonIndex);
    const mat = keep(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    const mesh = new Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh); return mesh;
  };
  const ribbonGlow = makeRibbon(1, 3); const ribbonCore = makeRibbon(1, 2);
  const ribbonWidth = spring(1, { stiffness: 90, damping: 7 });
  const head = spring(-0.02, { stiffness: 10, damping: 5.2 });
  const spark = spring3([-13, 4.2, -30], { stiffness: 16, damping: 6.2 }); // the opening particle
  const sparkSprite = new Sprite(additive('#bff0ff')); sparkSprite.scale.setScalar(0.9); scene.add(sparkSprite);
  let drawnIndex = -1; let drawing = false;
  const restAt = (u, out) => { const f = clamp01(u) * (N - 1); const i = Math.min(N - 2, Math.floor(f)); const k = f - i; return out.set(lerp(rest[i * 3], rest[i * 3 + 3], k), lerp(rest[i * 3 + 1], rest[i * 3 + 4], k), lerp(rest[i * 3 + 2], rest[i * 3 + 5], k)); };
  const headPos = new Vector3(); restAt(0, headPos);
  for (let i = 0; i < N; i += 1) { pos[i * 3] = headPos.x; pos[i * 3 + 1] = headPos.y; pos[i * 3 + 2] = headPos.z; }

  // ---------- HealthNova logo: extruded tile + extruded heart-pulse, on squash/stretch springs ----------
  const logo = new Group(); scene.add(logo);
  const tileShape = new Shape(); const r = 0.5; const s = 1;
  tileShape.moveTo(-s + r, -s); tileShape.lineTo(s - r, -s); tileShape.quadraticCurveTo(s, -s, s, -s + r); tileShape.lineTo(s, s - r); tileShape.quadraticCurveTo(s, s, s - r, s);
  tileShape.lineTo(-s + r, s); tileShape.quadraticCurveTo(-s, s, -s, s - r); tileShape.lineTo(-s, -s + r); tileShape.quadraticCurveTo(-s, -s, -s + r, -s);
  const depth = 0.34; const bevel = 0.08;
  const tileGeo = keep(new ExtrudeGeometry(tileShape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.07, bevelSegments: lite ? 3 : 5, curveSegments: lite ? 8 : 14 })); tileGeo.translate(0, 0, -depth / 2);
  const capMat = keep(new MeshStandardMaterial({ map: keep(logoGradientTexture()), roughness: 0.32, metalness: 0.18, emissive: '#0d3fa8', emissiveIntensity: 0.3 }));
  const sideMat = keep(new MeshStandardMaterial({ color: '#1b5fd8', roughness: 0.28, metalness: 0.45, emissive: '#0a2f80', emissiveIntensity: 0.35 }));
  logo.add(new Mesh(tileGeo, [capMat, sideMat]));
  const svg = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${HEART_PULSE_PATH}"/></svg>`);
  const iconGeo = keep(new ExtrudeGeometry(svg.paths.flatMap((p) => SVGLoader.createShapes(p)), { depth: 26, bevelEnabled: true, bevelThickness: 6, bevelSize: 4, bevelSegments: 2, curveSegments: lite ? 6 : 10 }));
  iconGeo.center(); iconGeo.rotateX(Math.PI); iconGeo.scale(1.12 / 512, 1.12 / 512, 1.12 / 512);
  const iconMat = keep(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.22, metalness: 0.05, emissive: '#e4f1ff', emissiveIntensity: 0.6, toneMapped: false }));
  const icon = new Mesh(iconGeo, iconMat); icon.position.set(0, -0.02, depth / 2 + bevel + 0.03); logo.add(icon);
  const halo = new Sprite(additive('#2f7dff')); halo.position.z = -0.7; halo.scale.setScalar(5); logo.add(halo);
  const logoScale = [spring(0, { stiffness: 260, damping: 11 }), spring(0, { stiffness: 260, damping: 11 }), spring(0, { stiffness: 260, damping: 11 })];
  const logoPos = spring3([0, 0.1, 0.8], { stiffness: 40, damping: 9 });
  const logoRotY = spring(-0.6, { stiffness: 28, damping: 5.5 }); const logoRotX = spring(0, { stiffness: 28, damping: 5.5 });
  const activation = spring(0, { stiffness: 24, damping: 9 });
  const haloSpring = spring(0, { stiffness: 30, damping: 7 });
  const LOGO_SIZE = portrait ? 0.95 : 0.85;
  const shockMat = keep(new MeshBasicMaterial({ color: '#8cc8ff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  const shockGeo = keep(new RingGeometry(1, 1.02, 96));
  const shocks = [0, 1].map(() => { const m = new Mesh(shockGeo, shockMat.clone()); keep(m.material); scene.add(m); return { mesh: m, t0: -1, strength: 1 }; });

  // ---------- Medical nodes with elastic connectors ----------
  const nodeGeo = keep(new IcosahedronGeometry(0.17, lite ? 1 : 2));
  const nodes = NODES.map((spec, i) => {
    const target = [spec.pos[0] * (portrait ? 0.55 : 1), spec.pos[1] * (portrait ? 1.2 : 1), spec.pos[2]];
    const group = new Group(); scene.add(group);
    const mat = keep(new MeshStandardMaterial({ color: '#8fdcff', emissive: '#2aa9ff', emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.1, transparent: true }));
    const sphere = new Mesh(nodeGeo, mat); group.add(sphere);
    const nodeGlow = new Sprite(additive('#3fb6ff')); nodeGlow.scale.setScalar(1.3); group.add(nodeGlow);
    const labelMat = keep(new SpriteMaterial({ map: keep(labelTexture(spec.label, spec.sub)), transparent: true, opacity: 0, depthWrite: false }));
    const label = new Sprite(labelMat); label.center.set(0.5, 1.15); group.add(label);
    const lineGeo = keep(new BufferGeometry()); lineGeo.setAttribute('position', new BufferAttribute(new Float32Array(21 * 3), 3));
    const lineMat = keep(new LineBasicMaterial({ color: '#5fb8ff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    const line = new Line(lineGeo, lineMat); line.frustumCulled = false; scene.add(line);
    const packet = new Sprite(additive('#c9f3ff')); packet.scale.setScalar(0.5); scene.add(packet);
    return {
      spec, target, group, mat, nodeGlow, label, labelMat, line, lineMat, packet, packetT: -1, spawned: false, phase: i * 1.7,
      pos: spring3([target[0], target[1], target[2] - 14], { stiffness: 70, damping: 8.4 }),
      scale: spring(0, { stiffness: 160, damping: 9 }),
      glow: spring(0.6, { stiffness: 40, damping: 6 }),
      bend: spring3([0, 0, 0], { stiffness: 26, damping: 2.6 }),
    };
  });

  // ---------- Glass status cards ----------
  const cardSpecs = lite || portrait ? CARDS.slice(0, 2) : CARDS;
  const cardGeo = keep(new PlaneGeometry(2.9, 1.245));
  const cards = cardSpecs.map((spec, i) => {
    const target = portrait ? PORTRAIT_CARDS[i] : spec.pos;
    const side = portrait ? (i ? 1 : -1) : Math.sign(spec.pos[0]);
    const face = keep(new MeshBasicMaterial({ map: keep(cardTexture(spec)), transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }));
    const back = keep(new MeshBasicMaterial({ map: face.map, color: '#3a5a9a', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }));
    const sheenMap = keep(sheenTexture()); sheenMap.repeat.set(0.55, 1);
    const sheen = keep(new MeshBasicMaterial({ map: sheenMap, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    const group = new Group(); const backMesh = new Mesh(cardGeo, back); backMesh.position.z = -0.07;
    const sheenMesh = new Mesh(cardGeo, sheen); sheenMesh.position.z = 0.004;
    group.add(backMesh, new Mesh(cardGeo, face), sheenMesh); group.scale.setScalar(portrait ? 0.82 : 1); scene.add(group);
    return {
      group, face, back, sheen, sheenMap, target, side, spawned: false, phase: i * 2.3, ry: portrait ? 0 : spec.ry,
      pos: spring3([target[0] + side * 4, target[1] - 1.5, target[2] - 9], { stiffness: 45, damping: 7.2 }),
      rotY: spring(side * 1.4, { stiffness: 34, damping: 5 }),
      scale: spring(0, { stiffness: 120, damping: 10 }),
    };
  });

  // ---------- Camera on springs (inertia, no shake) ----------
  const zs = portrait ? 1.45 : 1; const xsCam = portrait ? 0.4 : 1;
  const cam = spring3([0, 0.8, 38 * zs], { stiffness: 5, damping: 4.3 });
  const look = spring3([-4 * xsCam, 1, -10], { stiffness: 7, damping: 5.2 });
  const focus = spring(1, { stiffness: 14, damping: 7 }); // dims the network behind the brand typography
  const pointer = { x: 0, y: 0 }; const pointerSpring = spring3([0, 0, 0], { stiffness: 18, damping: 6 });

  // ---------- Events ----------
  const pulses = [];
  const events = [];
  const at = (t, fn) => events.push({ t, fn });
  function impact() { // the ECG reaches the dormant logo
    activation.to(1);
    logoScale[0].kick(5); logoScale[1].kick(-7.5); logoScale[2].kick(-4); logoScale.forEach((k) => k.to(1));
    logoRotY.to(0.14).kick(2.2); haloSpring.kick(9); coreFlash.kick(60); ribbonWidth.kick(6);
    shocks[0].t0 = time; shocks[0].strength = 1;
    onPhase?.('impact');
  }
  function heartbeat(strength = 1) { // the signature pulse through the whole system
    logoScale.forEach((k) => k.kick(5 * strength)); haloSpring.kick(8 * strength); coreFlash.kick(55 * strength);
    ribbonWidth.kick(10 * strength); pulses.push({ t0: time, amp: 0.95 * strength });
    const shock = shocks[strength < 1 ? 1 : 0]; shock.t0 = time; shock.strength = strength;
    nodes.forEach((node, i) => at(time + 0.06 + i * 0.07, () => {
      const dir = new Vector3(node.target[0], node.target[1], 0).normalize();
      node.pos.kick([dir.x * 3.2 * strength, dir.y * 3.2 * strength, 1.4 * strength]);
      node.scale.kick(5 * strength); node.glow.kick(7 * strength); node.bend.kick([-dir.y * 2.4 * strength, dir.x * 2.4 * strength, 1.2 * strength]);
      node.packetT = time;
    }));
    cards.forEach((card) => at(time + 0.14, () => { card.pos.kick([card.side * 1.8 * strength, 0.6 * strength, 0.8 * strength]); card.rotY.kick(-card.side * 1.1 * strength); }));
    if (!calm) cam.kick([0, 0.2 * strength, -2.6 * strength]);
  }
  const spawnNode = (node) => { node.spawned = true; node.pos.to(node.target); node.scale.to(1); node.bend.kick([random() - 0.5, 1.6, 0.6]); };
  const spawnCard = (card) => { card.spawned = true; card.pos.to(card.target); card.rotY.to(card.ry); card.scale.to(1); };

  let time = 0;
  if (calm || staticFrame) {
    // Settled composition: everything already at rest.
    drawing = true; drawnIndex = N - 1; head.snap(1);
    for (let i = 0; i < N * 3; i += 1) pos[i] = rest[i];
    logoScale.forEach((k) => k.snap(1)); activation.snap(1); logoRotY.snap(0.1); haloSpring.snap(0);
    nodes.forEach((n) => { n.spawned = true; n.pos.snap(n.target); n.scale.snap(1); });
    if (calm) cards.forEach((c) => { c.group.visible = false; });
    else cards.forEach((c) => { c.spawned = true; c.pos.snap(c.target); c.rotY.snap(c.ry); c.scale.snap(1); });
    sparkSprite.visible = false;
    if (calm) { cam.snap([0, 0.4, 14 * zs]); look.snap([0, 0.1, 0]); }
    else { cam.snap([0, 0.1, 14.5 * zs]); look.snap([0, -1.25, 0]); focus.snap(0.42); }
    if (calm) for (let k = 0; k < 40; k += 1) at(1.2 + k * 3.4, () => { heartbeat(0.55); at(time + 0.27, () => heartbeat(0.3)); });
  } else {
    at(0.85, () => { spark.to([rest[0], rest[1], rest[2]]); cam.to([-3 * xsCam, 1.2, 22 * zs]); look.to([-6 * xsCam, 0.8, -6]); });
    at(1.45, () => { drawing = true; head.to(0.5); cam.to([-1.5 * xsCam, 0.7, 15 * zs]); logoScale.forEach((k) => k.to(0.78)); onPhase?.('ecg'); });
    at(4.2, () => { /* safety: if the head never crossed the centre */ if (activation.target < 1) impact(); });
    at(3.6, () => { heartbeat(1); at(time + 0.27, () => heartbeat(0.5)); onPhase?.('pulse'); });
    at(4.55, () => { focus.to(0.42); cam.to([0, 0.1, 14.5 * zs]); look.to([0, -1.25, 0]); logoRotY.to(0); onPhase?.('brand'); });
    at(6.2, () => {
      cam.axes.forEach((a) => { a.k = 11; a.c = 6.4; }); look.axes.forEach((a) => { a.k = 14; a.c = 7; });
      cam.to([0, 0.1, 2.0]); look.to([0, 0.1, -6]); haloSpring.to(0.8); onPhase?.('dive');
    });
  }

  const tmp = new Vector3(); const tan = new Vector3(); const wv = new Vector3(); const bv = new Vector3(); const dir = new Vector3(); const Z = new Vector3(0, 0, 1);
  const c0 = new Vector3(); const c1 = new Vector3(); const c2 = new Vector3();
  let impacted = calm || staticFrame;
  let lastHeadIndex = -1;

  function stepChain(h) {
    const k = 46; const c = 6.2; const kc = 900;
    for (let i = 0; i < N; i += 1) {
      const o = i * 3;
      if (i > drawnIndex) { pos[o] = headPos.x; pos[o + 1] = headPos.y; pos[o + 2] = headPos.z; vel[o] = vel[o + 1] = vel[o + 2] = 0; continue; }
      const p = i > 0 ? o - 3 : o; const n = i < drawnIndex ? o + 3 : o;
      for (let a = 0; a < 3; a += 1) {
        const off = a === 1 ? pulseY[i] : 0;
        const d = pos[o + a] - rest[o + a] - off;
        const dp = pos[p + a] - rest[p + a] - (a === 1 ? pulseY[p / 3] : 0);
        const dn = pos[n + a] - rest[n + a] - (a === 1 ? pulseY[n / 3] : 0);
        vel[o + a] += (-k * d - c * vel[o + a] + kc * ((dp + dn) / 2 - d)) * h;
      }
    }
    for (let i = 0; i <= drawnIndex; i += 1) { const o = i * 3; pos[o] += vel[o] * h; pos[o + 1] += vel[o + 1] * h; pos[o + 2] += vel[o + 2] * h; }
  }

  function direct(t, dt) {
    while (events.length) {
      let next = 0; for (let i = 1; i < events.length; i += 1) if (events[i].t < events[next].t) next = i;
      if (events[next].t > t) break;
      events.splice(next, 1)[0].fn();
    }
    // The particle becomes the ribbon head; released points get a kick toward the camera → a 3D elastic wake.
    if (drawing) {
      restAt(head.x, headPos);
      const idx = Math.max(-1, Math.min(N - 1, Math.floor(clamp01(head.x) * (N - 1))));
      if (idx > lastHeadIndex && !calm && !staticFrame) {
        const speed = Math.abs(head.v) * 22;
        for (let i = lastHeadIndex + 1; i <= idx; i += 1) { vel[i * 3 + 2] += Math.min(5, speed * 0.28); vel[i * 3 + 1] += Math.min(2.2, speed * 0.09) * Math.sin(i * 0.16); }
      }
      lastHeadIndex = Math.max(lastHeadIndex, idx); drawnIndex = Math.max(drawnIndex, idx);
      if (!impacted && head.x >= 0.495) { impacted = true; impact(); at(t + 0.14, () => { head.k = 8; head.c = 5; head.to(1.03); }); }
    } else {
      spark.copyTo(headPos);
    }
    // Travelling heartbeat bump along the ribbon, outward from the centre.
    pulseY.fill(0);
    for (const p of pulses) {
      const age = t - p.t0; if (age > 2.5) continue;
      const front = age * 12; const decay = Math.exp(-age * 1.3);
      for (let i = 0; i < N; i += 1) pulseY[i] += p.amp * decay * Math.exp(-(((Math.abs(xs[i]) - front) / 1.1) ** 2));
    }
    // Camera direction while the ECG draws and while the nodes arrive (targets move; springs give inertia).
    if (!calm && !staticFrame) {
      if (t > 1.45 && t < 2.3) look.to([lerp(headPos.x, 0, 0.45), lerp(headPos.y, 0.2, 0.5), 0]);
      else if (t >= 2.3 && t < 4.55) {
        const o = t - 2.3;
        cam.to([Math.sin(o * 0.42) * 2.6 * xsCam, 0.7 + Math.sin(o * 0.3) * 0.35, (12.6 - o * 0.35) * zs]);
        look.to([0, 0.15, 0]);
      }
      if (t >= 2.25) nodes.forEach((n, i) => { if (!n.spawned && t >= 2.25 + i * 0.13) spawnNode(n); });
      if (t >= 2.95) cards.forEach((c, i) => { if (!c.spawned && t >= 2.95 + i * 0.16) spawnCard(c); });
    }
    if (calm) {
      const o = t;
      cam.to([Math.sin(o * 0.16) * 1.1 + pointerSpring.x * 2.2, 0.4 + Math.sin(o * 0.12) * 0.25 - pointerSpring.y * 1.2, 14 * zs]);
      pointerSpring.to([pointer.x, pointer.y, 0]);
    }
    // Floating: targets drift slightly, the springs turn that into living motion.
    nodes.forEach((n) => { if (n.spawned) n.pos.to([n.target[0] + Math.sin(t * 0.7 + n.phase) * 0.08, n.target[1] + Math.cos(t * 0.9 + n.phase) * 0.1, n.target[2]]); });
    cards.forEach((c) => { if (c.spawned) c.pos.to([c.target[0], c.target[1] + Math.sin(t * 0.8 + c.phase) * 0.1, c.target[2]]); });
    if (activation.target >= 1 && !staticFrame) { logoRotX.to(Math.sin(t * 0.55) * 0.06 * focus.x); if (t < 4.55 || calm) logoRotY.to(0.12 * Math.sin(t * 0.45) + (calm ? 0.1 : 0.06)); }
  }

  function render(t) {
    // Ribbon geometry from the simulated chain: width vector ⟂ tangent, twisted around it, tapered at the head.
    const coreP = ribbonCore.geometry.attributes.position.array; const glowP = ribbonGlow.geometry.attributes.position.array;
    const coreC = ribbonCore.geometry.attributes.color.array; const glowC = ribbonGlow.geometry.attributes.color.array;
    const width = Math.max(0.2, ribbonWidth.x);
    for (let i = 0; i < N; i += 1) {
      const o = i * 3; const p = Math.max(0, i - 2) * 3; const n = Math.min(N - 1, i + 2) * 3;
      const pa = Math.max(0, i - 1) * 3; const na = Math.min(N - 1, i + 1) * 3;
      tan.set(pos[n] - pos[p], pos[n + 1] - pos[p + 1], pos[n + 2] - pos[p + 2]);
      if (tan.lengthSq() < 1e-8) tan.set(1, 0, 0); tan.normalize();
      // Sharp turns (QRS peaks) would flip the width vector between neighbours and tear the strip into shards,
      // so the ribbon narrows where it bends hardest.
      tmp.set(pos[o] - pos[pa], pos[o + 1] - pos[pa + 1], pos[o + 2] - pos[pa + 2]); dir.set(pos[na] - pos[o], pos[na + 1] - pos[o + 1], pos[na + 2] - pos[o + 2]);
      const bend = tmp.lengthSq() > 1e-10 && dir.lengthSq() > 1e-10 ? 1 - tmp.normalize().dot(dir.normalize()) : 0;
      const narrow = 1 - Math.min(0.85, bend * 2.2);
      wv.crossVectors(tan, Z); if (wv.lengthSq() < 1e-6) wv.set(0, 1, 0); wv.normalize(); bv.crossVectors(tan, wv);
      const twist = 0.6 * Math.sin(i * 0.055 + t * 1.3) + Math.max(-0.8, Math.min(0.8, vel[o + 2] * 0.18));
      dir.copy(wv).multiplyScalar(Math.cos(twist)).addScaledVector(bv, Math.sin(twist));
      const u = i / (N - 1);
      const tip = drawnIndex >= 0 ? clamp01((drawnIndex - i) / 10) : 0;
      const fade = smooth(0, 0.1, u) * (1 - smooth(0.9, 1, u));
      const pulseBoost = 1 + pulseY[i] * 0.9;
      const hw = 0.05 * width * (0.35 + 0.65 * tip) * pulseBoost * (0.55 + 0.45 * narrow); const gw = 0.34 * width * (0.4 + 0.6 * tip) * pulseBoost * narrow;
      const hot = 0.75 + 0.25 * (1 - tip) + Math.min(0.6, pulseY[i]);
      for (let side = 0; side < 2; side += 1) {
        const sgn = side ? 1 : -1; const v = (i * 2 + side) * 3; const cI = (i * 2 + side) * 4;
        coreP[v] = pos[o] + dir.x * hw * sgn; coreP[v + 1] = pos[o + 1] + dir.y * hw * sgn; coreP[v + 2] = pos[o + 2] + dir.z * hw * sgn;
        coreC[cI] = 0.78 * hot; coreC[cI + 1] = 0.95 * hot; coreC[cI + 2] = 1; coreC[cI + 3] = fade;
      }
      // Glow: transparent edges, bright centre line → soft falloff instead of a hard band.
      const glowAlpha = fade * (0.32 + Math.min(0.45, pulseY[i] * 0.5));
      for (let col = 0; col < 3; col += 1) {
        const sgn = col - 1; const v = (i * 3 + col) * 3; const cI = (i * 3 + col) * 4;
        glowP[v] = pos[o] + dir.x * gw * sgn; glowP[v + 1] = pos[o + 1] + dir.y * gw * sgn; glowP[v + 2] = pos[o + 2] + dir.z * gw * sgn;
        glowC[cI] = 0.18; glowC[cI + 1] = 0.52; glowC[cI + 2] = 1; glowC[cI + 3] = col === 1 ? glowAlpha : 0;
      }
    }
    const segs = Math.max(0, drawnIndex);
    [[ribbonCore, 6], [ribbonGlow, 12]].forEach(([m, per]) => { m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.color.needsUpdate = true; m.geometry.setDrawRange(0, segs * per); });

    sparkSprite.position.copy(headPos);
    sparkSprite.material.opacity = calm || staticFrame ? 0 : drawing ? (head.x < 1 ? 1 : Math.max(0, 1 - (head.x - 1) * 30)) : smooth(0.1, 0.6, t);
    sparkSprite.scale.setScalar(drawing ? 1.2 : 1.1 + Math.min(1.6, Math.hypot(spark.axes[0].v, spark.axes[2].v) * 0.05));

    // Logo
    const act = clamp01(activation.x);
    logo.position.set(logoPos.x, logoPos.y, logoPos.z);
    logo.scale.set(Math.max(0, logoScale[0].x) * LOGO_SIZE, Math.max(0, logoScale[1].x) * LOGO_SIZE, Math.max(0.01, logoScale[2].x) * LOGO_SIZE);
    logo.rotation.set(logoRotX.x, logoRotY.x, 0);
    capMat.color.setScalar(lerp(0.2, 1, act)); capMat.emissiveIntensity = 0.04 + 0.3 * act + Math.max(0, haloSpring.x) * 0.05;
    sideMat.color.setScalar(lerp(0.25, 1, act)); iconMat.color.setScalar(lerp(0.28, 1, act)); iconMat.emissiveIntensity = 0.6 * act + Math.max(0, haloSpring.x) * 0.06;
    halo.material.opacity = Math.min(1, act * 0.55 + Math.max(0, haloSpring.x) * 0.12); halo.scale.setScalar(4.6 + Math.max(0, haloSpring.x) * 0.5);
    core.intensity = Math.max(0, coreFlash.x);
    shocks.forEach((sh) => {
      const age = time - sh.t0; const live = sh.t0 >= 0 && age < 1.4;
      sh.mesh.visible = live; if (!live) return;
      sh.mesh.position.set(logoPos.x, logoPos.y, logoPos.z - 0.3); sh.mesh.scale.setScalar(1.1 + (1 - Math.exp(-age * 3.2)) * 7 * sh.strength);
      sh.mesh.material.opacity = 0.32 * sh.strength * Math.exp(-age * 3.6);
    });

    // Nodes + connectors (quadratic curve whose control point is a wobbly spring)
    nodes.forEach((n) => {
      const sc = Math.max(0, n.scale.x); const vis = n.spawned ? Math.min(1, sc) : 0;
      n.group.position.set(n.pos.x, n.pos.y, n.pos.z); n.group.scale.setScalar(Math.max(0.001, sc));
      n.mat.opacity = vis; n.mat.emissiveIntensity = 0.9 + Math.max(0, n.glow.x) * 0.25;
      n.nodeGlow.material.opacity = vis * Math.min(1, 0.35 + Math.max(0, n.glow.x) * 0.12) * focus.x;
      n.label.scale.set(1.55, 0.51, 1); n.labelMat.opacity = vis * lerp(0.35, 1, focus.x);
      c0.set(logoPos.x, logoPos.y, logoPos.z - 0.2); c2.set(n.pos.x, n.pos.y, n.pos.z);
      c1.addVectors(c0, c2).multiplyScalar(0.5).add(tmp.set(n.bend.x, n.bend.y, n.bend.z));
      const arr = n.line.geometry.attributes.position.array;
      for (let j = 0; j <= 20; j += 1) { const u = j / 20; const a = (1 - u) * (1 - u); const b = 2 * (1 - u) * u; const d = u * u; arr[j * 3] = a * c0.x + b * c1.x + d * c2.x; arr[j * 3 + 1] = a * c0.y + b * c1.y + d * c2.y; arr[j * 3 + 2] = a * c0.z + b * c1.z + d * c2.z; }
      n.line.geometry.attributes.position.needsUpdate = true;
      n.lineMat.opacity = vis * 0.5 * lerp(0.5, 1, focus.x) * (activation.target >= 1 ? 1 : 0);
      const pa = n.packetT >= 0 ? (time - n.packetT) / 0.4 : 2;
      if (pa >= 0 && pa <= 1) { const u = pa; const a = (1 - u) * (1 - u); const b = 2 * (1 - u) * u; const d = u * u; n.packet.position.set(a * c0.x + b * c1.x + d * c2.x, a * c0.y + b * c1.y + d * c2.y, a * c0.z + b * c1.z + d * c2.z); n.packet.material.opacity = Math.sin(u * Math.PI); }
      else n.packet.material.opacity = 0;
    });

    // Cards: spring entrance, inertia on the heartbeat, sliding reflection
    cards.forEach((c) => {
      const sc = Math.max(0, c.scale.x); const vis = c.spawned ? Math.min(1, sc) * lerp(0.4, 1, focus.x) : 0;
      c.group.position.set(c.pos.x, c.pos.y, c.pos.z); c.group.rotation.set(Math.sin(time * 0.6 + c.phase) * 0.04, c.rotY.x, 0);
      c.group.scale.setScalar((portrait ? 0.82 : 1) * Math.max(0.001, sc));
      c.face.opacity = vis; c.back.opacity = vis * 0.45; c.sheen.opacity = vis * 0.9;
      c.sheenMap.offset.x = clamp01(0.5 + (camera.position.x - c.pos.x) * 0.07 + c.rotY.x * 0.5) * 1.1 - 0.55;
    });

    // Atmosphere
    const dawn = calm || staticFrame ? 1 : smooth(0.05, 1.3, t);
    atmosphere.forEach(({ s: sprite, max }) => { sprite.material.opacity = calm ? 0 : max * dawn; }); // the Login showcase has its own backdrop
    dustMat.opacity = 0.8 * dawn * lerp(0.6, 1, focus.x);
    if (!staticFrame) dust.rotation.y = t * 0.01;

    // Camera
    camera.position.set(cam.x + (calm ? 0 : pointerSpring.x * 0.3), cam.y - (calm ? 0 : pointerSpring.y * 0.18), cam.z);
    camera.lookAt(look.x, look.y, look.z);
    const dive = mode === 'intro' && !staticFrame ? smooth(6.2, 7.2, t) : 0;
    camera.fov = baseFov + 12 * dive * dive; camera.updateProjectionMatrix();
  }

  function step(dt) {
    time += dt;
    direct(time, dt);
    let remaining = Math.min(dt, 1 / 20);
    while (remaining > 1e-6) { const h = Math.min(1 / 240, remaining); for (const sp of springs) sp.step(h); stepChain(h); remaining -= h; }
    render(time);
  }

  // Precompile all shaders so the first animated frames do not stall.
  step(0); renderer.compile(scene, camera);

  const onResize = () => { const [w, h] = size(); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (staticFrame) renderer.render(scene, camera); };
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  resizeObserver?.observe(canvas); window.addEventListener('resize', onResize);
  const onPointer = (e) => { const rect = canvas.getBoundingClientRect(); pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1; };
  if (!lite && !staticFrame) window.addEventListener('pointermove', onPointer);
  const handleLost = (e) => { e.preventDefault(); onContextLost?.(); };
  canvas.addEventListener('webglcontextlost', handleLost);

  let raf = 0; let last = 0; let started = false; let ended = false; let disposed = false; let measured = 0; let slow = 0;
  const frame = (now) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!started) { started = true; last = now; onStart?.(); }
    const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
    if (measured < 45) { measured += 1; if (dt > 0.034) slow += 1; if (measured === 45 && slow > 20) { renderer.setPixelRatio(1); dustGeo.setDrawRange(0, Math.floor(dustCount / 2)); } }
    step(dt);
    renderer.render(scene, camera);
    if (mode === 'intro' && !ended && time >= INTRO_DURATION) { ended = true; cancelAnimationFrame(raf); onEnd?.(); }
  };
  const onVisibility = () => { if (!calm || disposed) return; if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    start() {
      if (staticFrame) { renderer.render(scene, camera); onStart?.(); return; }
      raf = requestAnimationFrame(frame);
    },
    pulse() { if (calm && !staticFrame) { heartbeat(0.9); at(time + 0.27, () => heartbeat(0.45)); } },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      resizeObserver?.disconnect(); window.removeEventListener('resize', onResize); window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility); canvas.removeEventListener('webglcontextlost', handleLost);
      disposables.forEach((d) => d.dispose?.()); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
