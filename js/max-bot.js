/**
 * Max: the floating robot guide for Kritagya Yadav's portfolio.
 *
 * - Lazy-loads three.js (mapped by the import map in index.html) after the page intro finishes,
 *   and only when the browser supports WebGL.
 * - Model: "Flying Robot 07" by Konstantin_Dem (Sketchfab), CC BY 4.0, optimized/modified.
 *   Credited in the site footer. An LED-matrix face is drawn onto the robot's screen.
 * - Floats beside the hero, hovers above each section heading as it scrolls into view, docks in
 *   the bottom-left corner while you read, and tows the section-transition curtain when you jump
 *   to a section. Talks about what is on screen and reacts to the page.
 * - The robot button in the bottom-left corner hides or shows Max; the choice is remembered.
 * - Honours prefers-reduced-motion: Max stays docked, does not fly, spin, or type letter by letter.
 */

const MODEL_URL = 'assets/models/max-robot.glb';
const DRACO_PATH = 'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/';
const HIDDEN_KEY = 'ky-bot-hidden';
const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const UNPROMPTED_GAP = 6500;   // minimum gap before Max speaks on his own again
const HOVER_DWELL = 650;       // how long the pointer must rest on something before Max comments
const HOVER_COOLDOWN = 25000;  // per-target cooldown for hover comments
const SKILL_COOLDOWN = 7000;
const SLEEP_AFTER = 40000;
const IDLE_CHAT_AFTER = 32000;
const NAV_CLEARANCE = 84;      // keep clear of the fixed navbar

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const damp = (current, target, lambda, dt) => target + (current - target) * Math.exp(-lambda * dt);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

const storage = {
  hidden() {
    try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch (e) { return false; }
  },
  setHidden(value) {
    try { localStorage.setItem(HIDDEN_KEY, value ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  },
};

/* ------------------------------------------------------------------------------------------------
 * Lines: everything Max says, written from the facts on this site
 * ---------------------------------------------------------------------------------------------- */

function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const LINES = {
  greet: () => `Good ${timeOfDay()}! I'm Max, Kritagya's robot guide.`,
  greetFollow: ["Scroll down and I'll show you around.", 'Psst: Ctrl+K jumps anywhere on this page.'],
  curtain: (label) => [`Next stop: ${label}!`, `Hold on tight, ${label} coming up!`, `This way to ${label}!`],
  sections: {
    about: [
      "This is the 'who is Kritagya' part. Short version: Java, Spring Boot, lots of tests.",
      'B.Tech CSE, class of 2027. Backend is his thing.',
    ],
    skills: [
      'His toolbox: 46 skills across 8 categories.',
      'Spring Boot, PostgreSQL, Redis, Docker... the usual suspects.',
    ],
    projects: ['Three backend builds. Click any card for the full breakdown.'],
    learning: ["What he's studying next: microservices, Kafka and Kubernetes."],
    education: ['B.Tech CSE at KCC ITM, CGPA 7.58. Plus two certifications.'],
    'github-activity': ['Live numbers straight from GitHub. Java leads the code.'],
    contact: [
      "Here's how to reach him. Email is fastest; there's a copy button.",
      "He's open to backend roles and internships.",
    ],
  },
  hover: {
    architecture: ['The diagram lives in here. Concurrency, explained.'],
    copy: ['Copy it, paste it, say hi.'],
    resume: ['One page, all signal.', 'The PDF version of everything here.'],
    theme: () => (root.getAttribute('data-theme') === 'light' ? ['Back to the dark side?'] : ['Light mode? Bold choice.']),
    palette: ['Psst: Ctrl+K works from anywhere.'],
    hire: ['Good call.', 'That button leads straight to his inbox.'],
    github: ['Where the source code lives.'],
    linkedin: ['The professional side of things.'],
    leetcode: ['Where the algorithms get practised.'],
    eventBooking: ['83 endpoints. @Version stops two people grabbing the same seat.'],
    linkpulse: ["This one's live on Render. The demo works."],
    keyvault: ['Small service, clean layers.'],
    code: ['That @Version line? It is the whole trick.'],
    terminal: ['A terminal with good taste.'],
    languages: ['Bytes of code, not opinions. Java wins.'],
  },
  skills: {
    languages: 'Java first. Always.',
    backend: 'Spring Boot territory.',
    databases: 'PostgreSQL for truth, Redis for speed.',
    security: 'JWTs, rotated refresh tokens, BCrypt. Locked down.',
    devops: 'Docker in, Render out, GitHub Actions in between.',
    testing: 'JUnit and Mockito keep the bugs honest.',
    tools: 'IntelliJ, Postman, Swagger: the daily kit.',
    core: 'The theory underneath the code.',
  },
  filters: {
    all: 'All three projects, back on stage.',
    concurrency: "High concurrency: that's the Event Booking System.",
    devops: 'Cloud & DevOps: LinkPulse ships itself to Render.',
    security: 'Security & APIs: Event Booking and KeyVault.',
  },
  copied: ['Copied! Your clipboard knows his email now.'],
  themeLight: ['Ooh, bright.'],
  themeDark: ['Ahh. Easier on my LEDs.'],
  poke: [
    'Beep! That tickles.',
    'Tip: press Ctrl+K to jump anywhere.',
    'Tip: press ? for keyboard shortcuts.',
    'I run on coffee. Java, obviously.',
    'Still here. Still floating.',
  ],
  dizzy: ["Okay, okay. I'm dizzy now."],
  idle: ['Still there? The projects are worth a look.', 'Psst: the Contact section has a copy-email button.'],
  wake: ["Oh! I'm up, I'm up."],
  hide: ["Okay, I'll hide. The robot button brings me back."],
  show: ["Max is back!"],
};

const lastPicked = new Map();
function pick(list, key) {
  if (list.length === 1) return list[0];
  let index;
  do { index = Math.floor(Math.random() * list.length); } while (index === lastPicked.get(key));
  lastPicked.set(key, index);
  return list[index];
}

// Things Max comments on when the pointer rests on them. Buttons come before the cards that contain them.
const HOVER_TARGETS = [
  ['[data-open-arch]', 'architecture'],
  ['.copy-email-btn', 'copy'],
  ['a[download]', 'resume'],
  ['.theme-toggle', 'theme'],
  ['#cmd-palette-trigger', 'palette'],
  ['a.btn-primary[href="#contact"]', 'hire'],
  ['a[href*="github.com/kritagya025"]', 'github'],
  ['a[href*="linkedin.com"]', 'linkedin'],
  ['a[href*="leetcode.com"]', 'leetcode'],
  ['[data-project-card="event-booking"]', 'eventBooking'],
  ['[data-project-card="linkpulse"]', 'linkpulse'],
  ['[data-project-card="keyvault"]', 'keyvault'],
  ['.code-card', 'code'],
  ['.hero-terminal', 'terminal'],
  ['#lang-card', 'languages'],
];

/* ------------------------------------------------------------------------------------------------
 * Face: an LED matrix drawn to a canvas texture, sized to the robot's screen
 * ---------------------------------------------------------------------------------------------- */

const CELL = 16;
const LED = '#7df9e8';

const EYES = {
  open: ['.##.', '####', '####', '.##.'],
  happy: ['.##.', '#..#', '....', '....'],
  wide: ['.##.', '#..#', '#..#', '.##.'],
  closed: ['....', '....', '####', '....'],
  cross: ['#..#', '.##.', '.##.', '#..#'],
  shades: ['####', '####', '.##.', '....'],
};
const MOUTHS = {
  smile: ['......', '#....#', '.####.'],
  grin: ['#....#', '######', '.####.'],
  flat: ['......', '.####.', '......'],
  open: ['.####.', '#....#', '.####.'],
  o: ['..##..', '.#..#.', '..##..'],
  wave: ['......', '.#.#.#', '#.#.#.'],
  smirk: ['......', '....##', '.####.'],
};
const ZZZ = ['###', '.#.', '###'];
const EXPRESSIONS = {
  neutral: { left: 'open', right: 'open', mouth: 'smile' },
  happy: { left: 'happy', right: 'happy', mouth: 'grin' },
  surprised: { left: 'wide', right: 'wide', mouth: 'o' },
  wink: { left: 'open', right: 'closed', mouth: 'grin' },
  sleepy: { left: 'closed', right: 'closed', mouth: 'flat' },
  dizzy: { left: 'cross', right: 'cross', mouth: 'wave' },
  cool: { left: 'shades', right: 'shades', mouth: 'smirk' },
};

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

class Face {
  constructor(THREE, aspect) {
    this.cols = 16;
    this.rows = clamp(Math.round(this.cols / aspect), 12, 20);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.cols * CELL;
    this.canvas.height = this.rows * CELL;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.top = Math.floor((this.rows - 10) / 2); // the face patterns span 10 rows
    this.key = '';
  }

  draw({ expr, blink, mouthOpen, lx, ly, zzz }) {
    const key = `${expr}|${blink}|${mouthOpen}|${lx}|${ly}|${zzz}`;
    if (key === this.key) return;
    this.key = key;

    const e = EXPRESSIONS[expr] || EXPRESSIONS.neutral;
    const lit = new Set();
    const stamp = (pattern, col, row) => {
      pattern.forEach((line, r) => {
        Array.from(line).forEach((ch, c) => { if (ch === '#') lit.add(`${col + c},${row + r}`); });
      });
    };
    const t = this.top;
    stamp(blink ? EYES.closed : EYES[e.left], 3 + lx, t + ly);
    stamp(blink ? EYES.closed : EYES[e.right], 9 + lx, t + ly);
    stamp(mouthOpen ? MOUTHS.open : MOUTHS[e.mouth], 5, t + 6);
    if (zzz) stamp(ZZZ, 13, Math.max(0, t - 2));

    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#07060d';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const on = lit.has(`${c},${r}`);
        ctx.shadowBlur = on ? 14 : 0;
        ctx.shadowColor = LED;
        ctx.fillStyle = on ? LED : 'rgba(255, 255, 255, 0.05)';
        roundedRect(ctx, c * CELL + 2.5, r * CELL + 2.5, CELL - 5, CELL - 5, 3);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Engine: three.js scene around the glTF robot
 * ---------------------------------------------------------------------------------------------- */

class Engine {
  constructor(THREE, gltf, canvas, size) {
    this.T = THREE;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.setSize(size);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0.3, 10);
    this.camera.lookAt(0, -0.45, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1f45, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 4, 6);
    const fill = new THREE.DirectionalLight(0xc9c4ff, 0.9);
    fill.position.set(-4, 1, 3);
    this.rim = new THREE.PointLight(0x8b5cf6, 28, 16, 2);
    this.rim.position.set(-3, 2.5, -2.5);
    this.scene.add(key, fill, this.rim);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.mount(gltf.scene);
  }

  setSize(size) {
    this.renderer.setSize(size, size, false);
  }

  /** Centre and scale the model, turn its screen towards the camera, and put the LED face on it. */
  mount(model) {
    const T = this.T;
    const holder = new T.Group();
    holder.add(model);
    this.pivot.add(holder);

    const screen = model.getObjectByName('Screen');
    model.updateMatrixWorld(true);
    let box = new T.Box3().setFromObject(model);
    if (screen) {
      const screenCenter = new T.Box3().setFromObject(screen).getCenter(new T.Vector3());
      if (screenCenter.z < box.getCenter(new T.Vector3()).z) {
        model.rotation.y += Math.PI;
        model.updateMatrixWorld(true);
        box = new T.Box3().setFromObject(model);
      }
    }
    const size = box.getSize(new T.Vector3());
    const scale = 3.9 / Math.max(size.x, size.y);
    holder.scale.setScalar(scale);
    holder.position.copy(box.getCenter(new T.Vector3())).multiplyScalar(-scale);
    holder.updateMatrixWorld(true);

    this.face = new Face(T, screen ? this.projectScreenUVs(screen) : 1);
    if (screen) screen.material = new T.MeshBasicMaterial({ map: this.face.texture, toneMapped: false, side: T.DoubleSide });

    // Thruster flames: under the jets' left/right positions, starting at the bottom of the model so the
    // body never hides them (falls back to the bottom corners when the jets are missing)
    const jets = ['JetL', 'JetR'].map((name) => model.getObjectByName(name)).filter(Boolean);
    const fitted = new T.Box3().setFromObject(holder);
    const bottom = fitted.min.y + 0.1;
    const front = fitted.max.z * 0.2;
    const points = jets.length
      ? jets.map((jet) => {
        const p = this.pivot.worldToLocal(jet.getWorldPosition(new T.Vector3()));
        return new T.Vector3(p.x * 0.85, bottom, front);
      })
      : [-0.3, 0.3].map((side) => new T.Vector3(side * (fitted.max.x - fitted.min.x), bottom, front));
    const flameTexture = this.flameTexture();
    this.flames = points.map((p) => {
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: flameTexture, transparent: true, depthWrite: false, toneMapped: false }));
      sprite.userData.base = p.clone();
      this.pivot.add(sprite);
      return sprite;
    });
  }

  /**
   * Give the screen planar UVs from how it faces the camera (horizontal = world X, vertical = world Y),
   * so the face texture always fills it upright. Returns the screen's width / height.
   */
  projectScreenUVs(screen) {
    const T = this.T;
    const geometry = screen.geometry;
    const pos = geometry.attributes.position;
    const rotation = new T.Matrix4().extractRotation(screen.matrixWorld);
    const axes = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)].map((a) => a.applyMatrix4(rotation));
    const hIdx = [0, 1, 2].reduce((best, i) => (Math.abs(axes[i].x) > Math.abs(axes[best].x) ? i : best), 0);
    const vIdx = [0, 1, 2].filter((i) => i !== hIdx).reduce((best, i) => (Math.abs(axes[i].y) > Math.abs(axes[best].y) ? i : best));
    const hSign = Math.sign(axes[hIdx].x) || 1;
    const vSign = Math.sign(axes[vIdx].y) || 1;
    const coord = (i, idx) => (idx === 0 ? pos.getX(i) : idx === 1 ? pos.getY(i) : pos.getZ(i));
    let minH = Infinity; let maxH = -Infinity; let minV = Infinity; let maxV = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const h = coord(i, hIdx) * hSign;
      const v = coord(i, vIdx) * vSign;
      minH = Math.min(minH, h); maxH = Math.max(maxH, h);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (coord(i, hIdx) * hSign - minH) / (maxH - minH || 1);
      uv[i * 2 + 1] = (coord(i, vIdx) * vSign - minV) / (maxV - minV || 1);
    }
    geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
    return (maxH - minH) / (maxV - minV || 1);
  }

  flameTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.18, 'rgba(125, 249, 232, 0.95)');
    g.addColorStop(0.55, 'rgba(153, 90, 242, 0.45)');
    g.addColorStop(1, 'rgba(153, 90, 242, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.quadraticCurveTo(16, 4, 28, 0);
    ctx.quadraticCurveTo(22, 70, 16, 128);
    ctx.quadraticCurveTo(10, 70, 4, 0);
    ctx.fill();
    const texture = new this.T.CanvasTexture(canvas);
    texture.colorSpace = this.T.SRGBColorSpace;
    return texture;
  }

  applyTheme() {
    const parts = getComputedStyle(root).getPropertyValue('--primary').trim().split(/\s+/);
    if (parts.length >= 3) this.rim.color.setStyle(`hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`);
  }

  /** Animate the model. `st` comes from the controller: motion, gaze, and one-off gestures. */
  update(dt, t, st) {
    const p = this.pivot;
    const bob = st.still ? 0 : Math.sin(t * 2.1) * 0.08;
    const hop = st.hopP >= 0 && st.hopP <= 1 ? Math.sin(st.hopP * Math.PI) * 0.45 : 0;
    p.position.y = bob + hop;
    const wiggle = st.waving ? Math.sin(t * 14) * 0.14 : 0;
    p.rotation.z = damp(p.rotation.z, st.bank + wiggle, 8, dt);
    p.rotation.x = damp(p.rotation.x, st.lookY * 0.18, 6, dt);
    if (st.spinP >= 0 && st.spinP <= 1) {
      p.rotation.y = easeInOut(st.spinP) * Math.PI * 2;
    } else {
      p.rotation.y = damp(p.rotation.y % (Math.PI * 2), st.yaw + st.lookX * 0.4, 5, dt);
    }

    const flicker = st.still ? 0 : Math.sin(t * 33) * 0.06;
    const thrust = (st.sleeping ? 0.55 : 0.9) + st.speed * 0.6 + flicker;
    this.flames.forEach((flame) => {
      const base = flame.userData.base;
      const length = 1.05 * thrust;
      flame.scale.set(0.42 + st.speed * 0.1, length, 1);
      flame.position.set(base.x, base.y - length / 2, base.z);
      flame.material.opacity = st.sleeping ? 0.5 : 0.95;
    });

    this.face.draw(st.face);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

/* ------------------------------------------------------------------------------------------------
 * Max: placement, flight, speech, and reactions
 * ---------------------------------------------------------------------------------------------- */

class Max {
  constructor(THREE, gltf) {
    this.layer = document.createElement('div');
    this.layer.className = 'bot-layer is-hidden';
    this.layer.setAttribute('aria-hidden', 'true');
    this.bubble = document.createElement('div');
    this.bubble.className = 'bot-bubble tail-left';
    this.bubbleText = document.createElement('span');
    this.bubble.appendChild(this.bubbleText);
    this.body = document.createElement('div');
    this.body.className = 'bot-body';
    this.canvas = document.createElement('canvas');
    // Only the robot itself is clickable, not the transparent corners of its canvas
    this.hit = document.createElement('div');
    this.hit.className = 'bot-hit';
    this.body.append(this.canvas, this.hit);
    this.layer.append(this.bubble, this.body);
    document.body.appendChild(this.layer);

    this.compact = this.isCompact();
    this.R = this.compact ? 150 : 260;
    this.layer.classList.toggle('is-compact', this.compact);
    this.body.style.width = this.body.style.height = `${this.R}px`;
    this.engine = new Engine(THREE, gltf, this.canvas, this.R);
    this.engine.applyTheme();

    const vh = window.innerHeight;
    this.s = {
      cx: 60, cy: vh + 160, vx: 0, vy: 0, scale: 0.5,
      expr: 'happy', exprUntil: 0,
      blinkAt: performance.now() + 2500, blinkUntil: 0,
      spinFrom: -1e9, hopFrom: -1e9, waveUntil: 0,
      cursor: null, lastInput: performance.now(), sleeping: false, sleptAt: 0,
      pokes: 0, pokeAt: 0,
    };
    this.target = null;
    this.mode = 'dock';
    this.curtain = null;          // 'tow' while pulling the section curtain in, 'hold' while it covers the page
    this.hidden = true;
    this.dialogOpen = false;
    this.speaking = false;
    this.typing = false;
    this.speakingPrio = 0;
    this.lastUnprompted = -1e9;
    this.lastTalk = performance.now();
    this.idleChats = 0;
    this.introduced = new Set();
    this.hoverCooldowns = new Map();
    this.lastSkillAt = 0;
    this.bubbleW = 0;
    this.bubbleH = 0;
    this.frame = 0;
    this.t = 0;
    this.last = performance.now();
    this.raf = 0;
    this.loop = this.loop.bind(this);
    this.bind();
  }

  isCompact() {
    return reducedMotion || !finePointer || window.innerWidth < 1024;
  }

  /* ---- lifecycle ---- */

  show({ greet = false } = {}) {
    clearTimeout(this.hideTimeout);
    this.hidden = false;
    this.layer.classList.remove('is-hidden');
    this.target = this.computeTarget();
    const vh = window.innerHeight;
    // Rise in from below the target (or appear in place for reduced motion)
    this.s.cx = this.target.cx;
    this.s.cy = reducedMotion ? this.target.cy : vh + this.R * 0.6;
    this.s.scale = this.target.scale;
    this.s.vx = this.s.vy = 0;
    this.s.waveUntil = performance.now() + 1400;
    this.start();
    if (greet) {
      setTimeout(() => this.greet(), reducedMotion ? 200 : 900);
    } else {
      this.say(pick(LINES.show, 'show'), { prio: 3, expr: 'happy' });
    }
  }

  hide() {
    this.say(pick(LINES.hide, 'hide'), { prio: 3, expr: 'wink' });
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      this.hidden = true;
      this.layer.classList.add('is-hidden');
      this.hideBubble();
      setTimeout(() => { if (this.hidden) this.stop(); }, 450);
    }, 1600);
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  greet() {
    const greeting = LINES.greet();
    this.say(greeting, { prio: 2, expr: 'happy' });
    const followDelay = (reducedMotion ? 0 : greeting.length * 24) + 2600;
    setTimeout(() => {
      if (this.mode === 'hero' || this.compact) this.say(pick(LINES.greetFollow, 'greetFollow'), { prio: 2, expr: 'neutral' });
    }, followDelay);
  }

  /* ---- page wiring ---- */

  bind() {
    const markInput = () => {
      const s = this.s;
      const now = performance.now();
      if (s.sleeping) {
        s.sleeping = false;
        if (now - s.sleptAt > 5000) this.say(pick(LINES.wake, 'wake'), { prio: 2, expr: 'surprised' });
      }
      s.lastInput = now;
    };

    window.addEventListener('pointermove', (e) => {
      this.s.cursor = { x: e.clientX, y: e.clientY };
      markInput();
    }, { passive: true });
    window.addEventListener('scroll', markInput, { passive: true });
    window.addEventListener('keydown', markInput);
    window.addEventListener('touchstart', markInput, { passive: true });

    window.addEventListener('resize', () => {
      const compact = this.isCompact();
      if (compact === this.compact) return;
      this.compact = compact;
      this.R = compact ? 150 : 260;
      this.layer.classList.toggle('is-compact', compact);
      this.body.style.width = this.body.style.height = `${this.R}px`;
      this.engine.setSize(this.R);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else if (!this.hidden) this.start();
    });

    // Poke Max
    this.hit.addEventListener('click', () => this.poke());
    this.hit.addEventListener('pointerenter', () => { if (!this.speaking) this.setExpr('happy', 1200); });

    // Hover commentary
    let hoverTimer = 0;
    let hoverEl = null;
    document.addEventListener('pointerover', (e) => {
      if (!finePointer || this.hidden || this.curtain) return;
      const match = this.matchHoverTarget(e.target);
      if (!match || match.el === hoverEl) return;
      hoverEl = match.el;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        const last = this.hoverCooldowns.get(match.key) || 0;
        if (performance.now() - last < HOVER_COOLDOWN) return;
        const source = typeof LINES.hover[match.key] === 'function' ? LINES.hover[match.key]() : LINES.hover[match.key];
        if (this.say(pick(source, `hover-${match.key}`), { prio: 1, expr: 'happy' })) {
          this.hoverCooldowns.set(match.key, performance.now());
        }
      }, HOVER_DWELL);
    });
    document.addEventListener('pointerout', (e) => {
      if (!hoverEl || (e.relatedTarget && hoverEl.contains(e.relatedTarget))) return;
      hoverEl = null;
      clearTimeout(hoverTimer);
    });

    // Section transitions: tow the curtain in, wait while it covers the page, then fly on
    document.addEventListener('ky:curtain', (e) => {
      if (this.hidden || this.compact) return;
      const { phase, label, id } = e.detail;
      if (phase === 'start') {
        this.curtain = 'tow';
        this.s.sleeping = false;
        this.say(pick(LINES.curtain(label), 'curtain'), { prio: 3, expr: 'cool' });
      } else if (phase === 'covered') {
        this.curtain = 'hold';
        this.setExpr('happy', 1200);
      } else if ((phase === 'reveal' || phase === 'end') && this.curtain) {
        // Take off as the curtain wipes away, then introduce the section he just delivered you to
        this.curtain = null;
        this.hideBubble();
        if (id) this.introduced.delete(id);
        this.lastUnprompted = -1e9;
      }
    });

    // Reactions to the page
    document.addEventListener('ky:filter', (e) => {
      const line = LINES.filters[e.detail.filter] || `Showing ${e.detail.label}.`;
      this.say(line, { prio: 2, expr: 'surprised', exprMs: 900, then: 'happy' });
    });
    document.addEventListener('ky:skill', (e) => {
      const now = performance.now();
      if (now - this.lastSkillAt < SKILL_COOLDOWN) return;
      const line = LINES.skills[e.detail.id];
      if (line && this.say(line, { prio: 2, expr: 'happy' })) this.lastSkillAt = now;
    });
    document.addEventListener('ky:copy-email', () => {
      this.s.waveUntil = performance.now() + 1200;
      this.say(pick(LINES.copied, 'copied'), { prio: 2, expr: 'happy' });
    });
    document.addEventListener('ky:themechange', (e) => {
      this.engine.applyTheme();
      const light = e.detail && e.detail.theme === 'light';
      this.say(pick(light ? LINES.themeLight : LINES.themeDark, 'theme'), { prio: 2, expr: light ? 'surprised' : 'happy' });
    });
    document.addEventListener('ky:dialog', () => {
      this.dialogOpen = !!document.querySelector('dialog[open]');
      if (this.dialogOpen) this.hideBubble();
    });
  }

  matchHoverTarget(node) {
    if (!(node instanceof Element) || this.body.contains(node)) return null;
    for (const [selector, key] of HOVER_TARGETS) {
      const el = node.closest(selector);
      if (el) return { el, key };
    }
    return null;
  }

  poke() {
    const s = this.s;
    const now = performance.now();
    s.lastInput = now;
    s.sleeping = false;
    s.pokes = now - s.pokeAt < 2500 ? s.pokes + 1 : 1;
    s.pokeAt = now;
    if (!reducedMotion) {
      s.hopFrom = now;
      if (s.pokes % 2 === 1) s.spinFrom = now;
    }
    if (s.pokes >= 4) {
      s.pokes = 0;
      this.say(pick(LINES.dizzy, 'dizzy'), { prio: 2, expr: 'dizzy', exprMs: 2200 });
    } else {
      this.say(pick(LINES.poke, 'poke'), { prio: 2, expr: Math.random() < 0.4 ? 'wink' : 'happy' });
    }
  }

  /* ---- speech ---- */

  setExpr(expr, ms) {
    this.s.expr = expr;
    this.s.exprUntil = performance.now() + ms;
  }

  /**
   * Show a speech bubble. prio 1 = unprompted (sections, hovers, idle), 2 = reactions, 3 = show/hide/curtain.
   * Returns false when the line was skipped (cooldown, a more important line is playing, or hidden).
   */
  say(text, { prio = 1, expr = 'happy', exprMs, then } = {}) {
    if (!text) return false;
    if (this.hidden && prio < 3) return false;
    if (this.dialogOpen) return false;
    if (this.curtain && prio < 3) return false;
    const now = performance.now();
    if (this.speaking && prio < this.speakingPrio) return false;
    if (prio <= 1 && now - this.lastUnprompted < UNPROMPTED_GAP) return false;
    if (prio <= 1) this.lastUnprompted = now;
    this.lastTalk = now;
    this.s.sleeping = false;

    clearInterval(this.typeTimer);
    clearTimeout(this.hideTimer);
    clearTimeout(this.exprTimer);
    this.speaking = true;
    this.speakingPrio = prio;
    const hold = clamp(text.length * 55, 2600, 6500);
    this.setExpr(expr, exprMs || hold + 600);
    if (then) this.exprTimer = setTimeout(() => this.setExpr(then, hold), exprMs);

    // Measure the full line first so the bubble does not resize while typing
    this.bubble.style.width = '';
    this.bubbleText.textContent = text;
    this.bubbleW = this.bubble.offsetWidth;
    this.bubbleH = this.bubble.offsetHeight;
    this.bubble.style.width = `${this.bubbleW}px`;
    this.bubble.classList.add('is-visible');

    const finish = () => {
      this.typing = false;
      this.hideTimer = setTimeout(() => this.hideBubble(), hold);
    };
    if (reducedMotion) {
      finish();
      return true;
    }
    this.bubbleText.textContent = '';
    this.typing = true;
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 1;
      this.bubbleText.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(this.typeTimer);
        finish();
      }
    }, 24);
    return true;
  }

  hideBubble() {
    clearInterval(this.typeTimer);
    clearTimeout(this.hideTimer);
    this.typing = false;
    this.speaking = false;
    this.speakingPrio = 0;
    this.bubble.classList.remove('is-visible');
  }

  /* ---- placement ---- */

  /** Where Max should be right now: towing the curtain, beside the hero, above a heading, or docked. */
  computeTarget() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const R = this.R;

    // Section curtain: ride its leading edge in, then wait at the left while the page changes
    if (this.curtain) {
      const scale = 0.72;
      const box = R * scale;
      const rest = box * 0.36 + 12;
      if (this.curtain === 'tow') {
        const curtainEl = document.getElementById('section-curtain');
        const left = curtainEl ? curtainEl.getBoundingClientRect().left : 0;
        return { mode: 'tow', scale, cx: Math.max(rest, left - box * 0.1), cy: vh * 0.5, snap: true };
      }
      return { mode: 'hold', scale, cx: rest, cy: vh * 0.5 };
    }

    const dock = () => {
      if (this.compact) {
        // Touch / small screens: sit small beside the robot toggle at the bottom edge so Max rarely covers content
        const scale = 0.5;
        const box = R * scale;
        return { mode: 'dock', scale, cx: 64 + box * 0.3, cy: vh - 30 - box * 0.12, section: this.visibleSection() };
      }
      const scale = 0.42;
      const box = R * scale;
      return { mode: 'dock', scale, cx: 18 + box * 0.32, cy: vh - 58 - box * 0.42, section: this.visibleSection() };
    };
    if (this.compact) return dock();

    // Hero: lean on the terminal card on wide screens, otherwise float in the open space on the right
    const hero = document.getElementById('top');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    if (heroRect && heroRect.bottom > vh * 0.55 && vw >= 1024) {
      const terminal = document.querySelector('.hero-terminal');
      const tr = terminal ? terminal.getBoundingClientRect() : null;
      if (tr && tr.width > 0) {
        const scale = 0.9;
        return { mode: 'hero', scale, cx: tr.left - R * scale * 0.12, cy: tr.top + tr.height * 0.3, section: 'top' };
      }
      return { mode: 'hero', scale: 1, cx: vw - Math.max(170, vw * 0.17), cy: vh * 0.4 + heroRect.top * 0.6, section: 'top' };
    }

    // Pinned project showcase: hover in the gutter beside the active card
    const pin = document.getElementById('projects-pin');
    if (pin && pin.classList.contains('is-pinned')) {
      const pr = pin.getBoundingClientRect();
      if (pr.top <= 1 && pr.bottom >= vh - 1) {
        const card = this.centeredProjectCard(vw);
        if (card) {
          const scale = 0.5;
          const gutter = vw - card.right;
          if (gutter >= R * scale * 0.7) {
            return { mode: 'anchor', scale, cx: card.right + gutter / 2, cy: card.top + R * scale * 0.4, section: 'projects' };
          }
        }
      }
    }

    // Section headings: hover just above the end of the numbered eyebrow label
    const heading = this.presentableEyebrow(R * 0.5, vh);
    if (heading) {
      const scale = 0.5;
      const box = R * scale;
      return { mode: 'anchor', scale, cx: heading.rect.right - box * 0.04, cy: heading.rect.top - box * 0.38, section: heading.section };
    }
    return dock();
  }

  centeredProjectCard(vw) {
    let best = null;
    document.querySelectorAll('.project-slot:not(.is-filtered-out) .project-card').forEach((card) => {
      const r = card.getBoundingClientRect();
      const distance = Math.abs(r.left + r.width / 2 - vw / 2);
      if (!best || distance < best.distance) best = { rect: r, distance };
    });
    return best && best.distance < vw * 0.25 ? best.rect : null;
  }

  eyebrowRect(eyebrow) {
    const label = eyebrow.querySelector('span') || eyebrow;
    const range = document.createRange();
    range.selectNodeContents(label);
    return range.getBoundingClientRect();
  }

  presentableEyebrow(box, vh) {
    let best = null;
    document.querySelectorAll('main section[id] .eyebrow').forEach((eyebrow) => {
      const rect = this.eyebrowRect(eyebrow);
      if (rect.top < NAV_CLEARANCE + box * 0.8 || rect.top > vh * 0.86) return;
      const score = Math.abs(rect.top - vh * 0.55);
      if (!best || score < best.score) best = { rect, score, section: eyebrow.closest('section').id };
    });
    return best;
  }

  visibleSection() {
    const vh = window.innerHeight;
    let current = null;
    document.querySelectorAll('main section[id]').forEach((section) => {
      if (section.getBoundingClientRect().top <= vh * 0.5) current = section.id;
    });
    return current;
  }

  /* ---- frame loop ---- */

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.frame += 1;
    const s = this.s;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!this.target || this.curtain || this.frame % 3 === 0) this.target = this.computeTarget();
    const tg = this.target;
    this.mode = tg.mode;

    // Introduce each section once, the first time Max presents it
    const section = tg.section;
    if (section && LINES.sections[section] && !this.introduced.has(section) && this.frame % 15 === 0) {
      if (this.say(pick(LINES.sections[section], `section-${section}`), { prio: 1, expr: 'happy' })) {
        this.introduced.add(section);
      }
    }

    // Spring towards the target, ride the curtain edge exactly, or snap for reduced motion
    const box = this.R * s.scale;
    const tx = tg.snap ? tg.cx : clamp(tg.cx, box * 0.3 + 8, vw - box * 0.3 - 8);
    const ty = tg.snap ? tg.cy : clamp(tg.cy, NAV_CLEARANCE + box * 0.3, vh - box * 0.4);
    if (reducedMotion) {
      s.cx = tx;
      s.cy = ty;
      s.scale = tg.scale;
    } else if (tg.snap) {
      s.vx = (tx - s.cx) / dt;
      s.vy = damp(s.vy, 0, 10, dt);
      s.cx = tx;
      s.cy = damp(s.cy, ty, 9, dt);
      s.scale = damp(s.scale, tg.scale, 9, dt);
    } else {
      const k = 26;
      const c = 2 * Math.sqrt(k) * 0.85;
      s.vx += (k * (tx - s.cx) - c * s.vx) * dt;
      s.vy += (k * (ty - s.cy) - c * s.vy) * dt;
      s.cx += s.vx * dt;
      s.cy += s.vy * dt;
      s.scale = damp(s.scale, tg.scale, 6, dt);
    }
    const R = this.R;
    this.body.style.transform = `translate3d(${(s.cx - R / 2).toFixed(1)}px, ${(s.cy - R / 2).toFixed(1)}px, 0) scale(${s.scale.toFixed(3)})`;

    // Mood: sleep after a long idle, chat a little when the visitor has been quiet
    const idleFor = now - s.lastInput;
    if (!s.sleeping && idleFor > SLEEP_AFTER && !this.speaking && !this.curtain) {
      s.sleeping = true;
      s.sleptAt = now;
    }
    if (!s.sleeping && !this.speaking && !this.curtain && now - this.lastTalk > IDLE_CHAT_AFTER && this.idleChats < 2) {
      if (this.say(pick(LINES.idle, 'idle'), { prio: 1, expr: 'neutral' })) this.idleChats += 1;
    }
    if (now > s.blinkAt) {
      s.blinkUntil = now + 130;
      s.blinkAt = now + 2200 + Math.random() * 3200;
    }

    // Gaze: follow the cursor when there is one, otherwise glance around slowly
    const headX = s.cx;
    const headY = s.cy - this.R * s.scale * 0.08;
    let lookX;
    let lookY;
    if (this.curtain === 'tow') {
      lookX = -0.8;
      lookY = 0;
    } else if (s.cursor && finePointer) {
      lookX = clamp((s.cursor.x - headX) / (vw * 0.35), -1, 1);
      lookY = clamp((s.cursor.y - headY) / (vh * 0.35), -1, 1);
    } else {
      lookX = Math.sin(this.t * 0.35) * 0.4;
      lookY = Math.sin(this.t * 0.23) * 0.2;
    }
    if (s.sleeping) { lookX = 0; lookY = 0.3; }

    const expr = s.sleeping ? 'sleepy' : now < s.exprUntil ? s.expr : 'neutral';
    const spinP = reducedMotion ? -1 : (now - s.spinFrom) / 800;
    const hopP = reducedMotion ? -1 : (now - s.hopFrom) / 520;
    const speed = clamp(Math.hypot(s.vx, s.vy) / 900, 0, 1);
    this.engine.update(dt, this.t, {
      still: reducedMotion || s.sleeping,
      bank: reducedMotion ? 0 : clamp(-s.vx * 0.0004, -0.35, 0.35),
      yaw: reducedMotion ? 0 : clamp(s.vx * 0.0005, -0.45, 0.45),
      lookX,
      lookY,
      spinP: spinP <= 1 ? spinP : -1,
      hopP: hopP <= 1 ? hopP : -1,
      waving: now < s.waveUntil,
      sleeping: s.sleeping,
      speed,
      face: {
        expr,
        blink: now < s.blinkUntil && !s.sleeping && expr !== 'dizzy' && expr !== 'cool',
        mouthOpen: this.typing && Math.floor(this.t * 9) % 2 === 0,
        lx: Math.round(clamp(lookX * 1.3, -1, 1)),
        ly: Math.round(clamp(lookY * 1.3, -1, 1)),
        zzz: s.sleeping && Math.floor(this.t * 1.5) % 2 === 0,
      },
    });
    this.engine.render();

    if (this.bubble.classList.contains('is-visible')) this.placeBubble(headX, headY, this.R * s.scale, vw, vh);
  }

  placeBubble(headX, headY, box, vw, vh) {
    const half = box * 0.3;
    const bw = this.bubbleW;
    const bh = this.bubbleH;
    let left;
    let tail;
    if (headX + half + 12 + bw <= vw - 8) {
      left = headX + half + 10;
      tail = 'tail-left';
    } else {
      left = headX - half - 10 - bw;
      tail = 'tail-right';
    }
    left = clamp(left, 8, vw - bw - 8);
    const top = clamp(headY - bh * 0.6, NAV_CLEARANCE - 8, vh - bh - 8);
    if (!this.bubble.classList.contains(tail)) {
      this.bubble.classList.remove('tail-left', 'tail-right');
      this.bubble.classList.add(tail);
    }
    this.bubble.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Boot: toggle button, lazy three.js + model loading, and first appearance
 * ---------------------------------------------------------------------------------------------- */

function whenPageReady() {
  return new Promise((resolve) => {
    if (root.dataset.ready === 'true') { resolve(); return; }
    document.addEventListener('ky:ready', () => resolve(), { once: true });
  });
}

function whenIdle() {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 2000 });
    else setTimeout(resolve, 800);
  });
}

async function loadMax() {
  const [THREE, { GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ]);
  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(MODEL_URL);
  draco.dispose();
  return new Max(THREE, gltf);
}

(function boot() {
  if (!webglAvailable()) return;

  let hidden = storage.hidden();
  let max = null;
  let loading = null;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'bot-toggle glass-card';
  toggle.innerHTML = '<i class="fas fa-robot text-sm" aria-hidden="true"></i>';
  const syncToggle = () => {
    toggle.setAttribute('aria-pressed', hidden ? 'false' : 'true');
    toggle.setAttribute('aria-label', hidden ? 'Show Max, the robot guide' : 'Hide Max, the robot guide');
    toggle.title = hidden ? 'Show Max' : 'Hide Max';
  };
  syncToggle();
  document.body.appendChild(toggle);

  function ensureMax() {
    if (max) return Promise.resolve(max);
    if (!loading) {
      loading = loadMax()
        .then((instance) => { max = instance; return max; })
        .catch((err) => {
          console.warn('[Max] could not start:', err);
          toggle.remove();
          return null;
        });
    }
    return loading;
  }

  toggle.addEventListener('click', () => {
    hidden = !hidden;
    storage.setHidden(hidden);
    syncToggle();
    if (hidden) {
      if (max) max.hide();
      return;
    }
    ensureMax().then((m) => { if (m) m.show(); });
  });

  if (hidden) return;
  whenPageReady()
    .then(whenIdle)
    .then(ensureMax)
    .then((m) => { if (m && !hidden) m.show({ greet: true }); });
})();
