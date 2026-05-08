const btn = document.getElementById("pulseBtn");
const pulse = document.getElementById("pulse");
const canvas = document.getElementById("fxCanvas");

function setRippleOrigin(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  el.style.setProperty("--x", `${x}px`);
  el.style.setProperty("--y", `${y}px`);
}

function setRippleOriginCenter(el) {
  const rect = el.getBoundingClientRect();
  setRippleOrigin(el, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function setPulseOrigin(clientX, clientY) {
  pulse.style.setProperty("--px", `${clientX}px`);
  pulse.style.setProperty("--py", `${clientY}px`);
}

function retriggerAnimation(el) {
  el.classList.remove("is-animating");
  void el.offsetWidth;
  el.classList.add("is-animating");
}

function triggerPulseAt(clientX, clientY) {
  setPulseOrigin(clientX, clientY);
  retriggerAnimation(pulse);
  emitBurst(clientX, clientY);
}

btn.addEventListener("pointerdown", (e) => {
  setRippleOrigin(btn, e.clientX, e.clientY);
  retriggerAnimation(btn);
  triggerPulseAt(e.clientX, e.clientY);
});

btn.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  setRippleOriginCenter(btn);
  retriggerAnimation(btn);
  const rect = btn.getBoundingClientRect();
  triggerPulseAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
});

window.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== " ") return;
    if (e.repeat) return;
    e.preventDefault();

    setRippleOriginCenter(btn);
    retriggerAnimation(btn);

    const rect = btn.getBoundingClientRect();
    triggerPulseAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  },
  { passive: false },
);

btn.addEventListener("animationend", (e) => {
  if (e.animationName !== "thump") return;
  btn.classList.remove("is-animating");
});

pulse.addEventListener("animationend", () => {
  pulse.classList.remove("is-animating");
});

// --- Starfield + floating particles (canvas, lightweight) ---
const ctx = canvas.getContext("2d", { alpha: true });
let w = 0;
let h = 0;
let dpr = 1;

const stars = [];
const floaters = [];
let lastT = performance.now();

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function resize() {
  dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  w = Math.floor(window.innerWidth);
  h = Math.floor(window.innerHeight);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const starCount = Math.floor(clamp((w * h) / 14000, 70, 180));
  stars.length = 0;
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(0.6, 1.5),
      a: rand(0.12, 0.55),
      tw: rand(0.7, 1.8),
      ph: rand(0, Math.PI * 2),
    });
  }

  const floaterCount = Math.floor(clamp((w * h) / 52000, 18, 42));
  floaters.length = 0;
  for (let i = 0; i < floaterCount; i++) {
    floaters.push(makeFloater());
  }
}

function makeFloater(x = Math.random() * w, y = Math.random() * h) {
  const speed = rand(6, 18);
  const ang = rand(0, Math.PI * 2);
  return {
    x,
    y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    r: rand(0.8, 2.2),
    a: rand(0.05, 0.18),
    hue: Math.random() < 0.5 ? 190 : 285,
    wob: rand(0.6, 1.6),
    ph: rand(0, Math.PI * 2),
  };
}

function emitBurst(cx, cy) {
  // small burst to reinforce the pulse, but keep it cheap
  const count = 10;
  for (let i = 0; i < count; i++) {
    const p = makeFloater(cx, cy);
    p.r = rand(0.8, 1.8);
    p.a = rand(0.12, 0.22);
    const s = rand(40, 90);
    const ang = rand(0, Math.PI * 2);
    p.vx = Math.cos(ang) * s;
    p.vy = Math.sin(ang) * s;
    p.wob = rand(1.4, 2.6);
    floaters.push(p);
  }

  // cap array size to avoid perf issues over time
  if (floaters.length > 120) floaters.splice(0, floaters.length - 120);
}

function draw(t) {
  const dt = clamp((t - lastT) / 1000, 0, 0.05);
  lastT = t;

  ctx.clearRect(0, 0, w, h);

  // subtle nebula glow
  const g = ctx.createRadialGradient(w * 0.35, h * 0.25, 0, w * 0.35, h * 0.25, Math.max(w, h) * 0.7);
  g.addColorStop(0, "rgba(79,242,255,0.06)");
  g.addColorStop(0.55, "rgba(208,107,255,0.03)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // stars
  for (const s of stars) {
    const a = s.a * (0.65 + 0.35 * Math.sin(t / 1000 * s.tw + s.ph));
    ctx.fillStyle = `rgba(230,245,255,${a.toFixed(4)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // floating particles (random-ish drift via wobble)
  for (let i = 0; i < floaters.length; i++) {
    const p = floaters[i];
    p.ph += dt * p.wob;
    const wx = Math.cos(p.ph) * 8;
    const wy = Math.sin(p.ph * 0.9) * 8;

    p.x += (p.vx * dt) + wx * dt;
    p.y += (p.vy * dt) + wy * dt;

    // damping to make them "float"
    p.vx *= 0.98;
    p.vy *= 0.98;

    // wrap around screen softly
    if (p.x < -20) p.x = w + 20;
    if (p.x > w + 20) p.x = -20;
    if (p.y < -20) p.y = h + 20;
    if (p.y > h + 20) p.y = -20;

    const alpha = p.a;
    ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${alpha.toFixed(4)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

resize();
window.addEventListener("resize", resize, { passive: true });
requestAnimationFrame(draw);

