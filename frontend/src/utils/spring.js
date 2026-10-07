// Damped spring physics shared by the 3D scenes and the DOM brand animations.
// A spring is only ever given a target or a velocity kick; overshoot, squash and settling come from the simulation.

export class Spring {
  constructor(value = 0, { stiffness = 170, damping = 14, mass = 1 } = {}) {
    this.x = value; this.v = 0; this.target = value;
    this.k = stiffness; this.c = damping; this.m = mass;
  }

  step(dt) {
    const force = -this.k * (this.x - this.target) - this.c * this.v;
    this.v += (force / this.m) * dt;
    this.x += this.v * dt;
  }

  kick(velocity) { this.v += velocity; return this; }
  to(target) { this.target = target; return this; }
  snap(value = this.target) { this.x = value; this.target = value; this.v = 0; return this; }
}

export class Spring3 {
  constructor([x, y, z] = [0, 0, 0], options) {
    this.axes = [new Spring(x, options), new Spring(y, options), new Spring(z, options)];
  }

  step(dt) { this.axes.forEach((s) => s.step(dt)); }
  to([x, y, z]) { this.axes[0].to(x); this.axes[1].to(y); this.axes[2].to(z); return this; }
  kick([x, y, z]) { this.axes[0].kick(x); this.axes[1].kick(y); this.axes[2].kick(z); return this; }
  snap(value) { this.axes.forEach((s, i) => s.snap(value ? value[i] : s.target)); return this; }
  get x() { return this.axes[0].x; } get y() { return this.axes[1].x; } get z() { return this.axes[2].x; }
  copyTo(vector) { return vector.set(this.axes[0].x, this.axes[1].x, this.axes[2].x); }
}

// Steps a set of springs with a fixed sub-step so stiff springs stay stable at any frame rate.
export function stepAll(springs, dt, subStep = 1 / 240) {
  let remaining = Math.min(dt, 1 / 20);
  while (remaining > 1e-6) {
    const h = Math.min(subStep, remaining);
    for (const spring of springs) spring.step(h);
    remaining -= h;
  }
}

// Samples a 0→1 spring response into a CSS linear() easing, e.g. for letter-by-letter brand reveals.
export function springEasing({ stiffness = 180, damping = 12, samples = 48 } = {}) {
  const spring = new Spring(0, { stiffness, damping }).to(1);
  const dt = 1 / 120; const values = [0];
  let settledAt = 0;
  for (let i = 1; i < 600; i += 1) {
    stepAll([spring], dt, dt);
    values.push(spring.x);
    if (Math.abs(spring.x - 1) < 0.001 && Math.abs(spring.v) < 0.01) { settledAt = i; break; }
  }
  const total = settledAt || values.length - 1;
  const points = [];
  for (let i = 0; i <= samples; i += 1) points.push(values[Math.round((i / samples) * total)].toFixed(3));
  points[points.length - 1] = '1';
  return { easing: `linear(${points.join(', ')})`, duration: total / 120 };
}

// Exposes physics-derived easings as CSS custom properties (--spring-pop, --spring-soft), when linear() is supported.
export function installSpringEasings(root = document.documentElement) {
  if (!window.CSS?.supports?.('animation-timing-function', 'linear(0, 1)')) return;
  const pop = springEasing({ stiffness: 210, damping: 13 });
  const soft = springEasing({ stiffness: 120, damping: 14 });
  root.style.setProperty('--spring-pop', pop.easing);
  root.style.setProperty('--spring-pop-duration', `${pop.duration.toFixed(2)}s`);
  root.style.setProperty('--spring-soft', soft.easing);
  root.style.setProperty('--spring-soft-duration', `${soft.duration.toFixed(2)}s`);
}
