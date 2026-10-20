/**
 * Bean: the floating robot guide for Kritagya Yadav's portfolio.
 *
 * - Lazy-loads three.js (mapped by the import map in index.html) after the page intro finishes,
 *   and only when the browser supports WebGL.
 * - Renders a small procedural robot with an LED-matrix face, so no model files are needed.
 * - Floats beside the hero, hovers above each section heading as it scrolls into view, and docks
 *   in the bottom-left corner while you read. Talks about what is on screen and reacts to the page
 *   (project filters, skill tabs, theme changes, copied email, clicks).
 * - The robot button in the bottom-left corner hides or shows Bean; the choice is remembered.
 * - Honours prefers-reduced-motion: Bean stays docked, does not fly, spin, or type letter by letter.
 */

const HIDDEN_KEY = 'ky-bot-hidden';
const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const UNPROMPTED_GAP = 6500;   // minimum gap before Bean speaks on his own again
const HOVER_DWELL = 650;       // how long the pointer must rest on something before Bean comments
const HOVER_COOLDOWN = 25000;  // per-target cooldown for hover comments
const SKILL_COOLDOWN = 7000;
const SLEEP_AFTER = 40000;
const IDLE_CHAT_AFTER = 32000;
const NAV_CLEARANCE = 84;      // keep clear of the fixed navbar

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const damp = (current, target, lambda, dt) => target + (current - target) * Math.exp(-lambda * dt);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function cssColor(name, fallback) {
  const parts = getComputedStyle(root).getPropertyValue(name).trim().split(/\s+/);
  return parts.length >= 3 ? `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})` : fallback;
}

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
 * Lines: everything Bean says, written from the facts on this site
 * ---------------------------------------------------------------------------------------------- */

function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const LINES = {
  greet: () => `Good ${timeOfDay()}! I'm Bean, Kritagya's JavaBean-powered guide.`,
  greetFollow: ["Scroll down and I'll show you around.", 'Psst: Ctrl+K jumps anywhere on this page.'],
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
    "I run on Java. It's in my name.",
    'Still here. Still floating.',
  ],
  dizzy: ["Okay, okay. I'm dizzy now."],
  idle: ['Still there? The projects are worth a look.', 'Psst: the Contact section has a copy-email button.'],
  wake: ["Oh! I'm up, I'm up."],
  hide: ["Okay, I'll hide. The robot button brings me back."],
  show: ["I'm back!"],
};

const lastPicked = new Map();
function pick(list, key) {
  if (list.length === 1) return list[0];
  let index;
  do { index = Math.floor(Math.random() * list.length); } while (index === lastPicked.get(key));
  lastPicked.set(key, index);
  return list[index];
}

// Things Bean comments on when the pointer rests on them. Buttons come before the cards that contain them.
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
 * Face: a 16 x 12 LED matrix drawn to a canvas texture
 * ---------------------------------------------------------------------------------------------- */

const COLS = 16;
const ROWS = 12;
const CELL = 16;
const LED = '#6ef5dc';

const EYES = {
  open: ['.##.', '####', '####', '.##.'],
  happy: ['.##.', '#..#', '....', '....'],
  wide: ['.##.', '#..#', '#..#', '.##.'],
  closed: ['....', '....', '####', '....'],
  cross: ['#..#', '.##.', '.##.', '#..#'],
};
const MOUTHS = {
  smile: ['......', '#....#', '.####.'],
  grin: ['#....#', '######', '.####.'],
  flat: ['......', '.####.', '......'],
  open: ['.####.', '#....#', '.####.'],
  o: ['..##..', '.#..#.', '..##..'],
  wave: ['......', '.#.#.#', '#.#.#.'],
};
const ZZZ = ['###', '.#.', '###'];
const EXPRESSIONS = {
  neutral: { left: 'open', right: 'open', mouth: 'smile' },
  happy: { left: 'happy', right: 'happy', mouth: 'grin' },
  surprised: { left: 'wide', right: 'wide', mouth: 'o' },
  wink: { left: 'open', right: 'closed', mouth: 'grin' },
  sleepy: { left: 'closed', right: 'closed', mouth: 'flat' },
  dizzy: { left: 'cross', right: 'cross', mouth: 'wave' },
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
  constructor(THREE) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = COLS * CELL;
    this.canvas.height = ROWS * CELL;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
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
    stamp(blink ? EYES.closed : EYES[e.left], 3 + lx, 2 + ly);
    stamp(blink ? EYES.closed : EYES[e.right], 9 + lx, 2 + ly);
    stamp(mouthOpen ? MOUTHS.open : MOUTHS[e.mouth], 5, 7);
    if (zzz) stamp(ZZZ, 13, 0);

    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0812';
    roundedRect(ctx, 0, 0, W, H, 30);
    ctx.fill();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const on = lit.has(`${c},${r}`);
        ctx.shadowBlur = on ? 14 : 0;
        ctx.shadowColor = LED;
        ctx.fillStyle = on ? LED : 'rgba(255, 255, 255, 0.055)';
        roundedRect(ctx, c * CELL + 2.5, r * CELL + 2.5, CELL - 5, CELL - 5, 3);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    roundedRect(ctx, 0, 0, W, H, 30);
    ctx.fill();
    this.texture.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Engine: three.js scene with a procedural robot
 * ---------------------------------------------------------------------------------------------- */

class Engine {
  constructor(THREE, RoundedBoxGeometry, canvas, size) {
    this.T = THREE;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.setSize(size);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0.2, 10.2);
    this.camera.lookAt(0, -0.42, 0);
    this.face = new Face(THREE);
    this.build(RoundedBoxGeometry);
    this.applyTheme();
  }

  setSize(size) {
    this.renderer.setSize(size, size, false);
  }

  build(RoundedBoxGeometry) {
    const T = this.T;
    const mesh = (geometry, material) => new T.Mesh(geometry, material);

    this.shellMat = new T.MeshStandardMaterial({ roughness: 0.32, metalness: 0.15 });
    this.trimMat = new T.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 });
    this.darkMat = new T.MeshStandardMaterial({ color: '#211b31', roughness: 0.45, metalness: 0.35 });
    this.glowMat = new T.MeshStandardMaterial({ roughness: 0.3, emissiveIntensity: 1.3 });
    this.chestMat = new T.MeshBasicMaterial({ toneMapped: false });
    this.screenMat = new T.MeshBasicMaterial({ map: this.face.texture, transparent: true, toneMapped: false });

    this.hemi = new T.HemisphereLight(0xffffff, 0x2a1f45, 1.25);
    this.keyLight = new T.DirectionalLight(0xffffff, 2.4);
    this.keyLight.position.set(3, 4, 6);
    this.rimLight = new T.DirectionalLight(0xffffff, 2.2);
    this.rimLight.position.set(-4, 2, -4);
    this.scene.add(this.hemi, this.keyLight, this.rimLight);

    const bot = new T.Group();
    this.bot = bot;
    this.scene.add(bot);

    // Head: chunky rounded "TV" with an LED screen
    const head = new T.Group();
    head.position.y = 0.35;
    this.head = head;
    bot.add(head);
    head.add(mesh(new RoundedBoxGeometry(2.1, 1.7, 1.5, 5, 0.38), this.shellMat));
    const bezel = mesh(new RoundedBoxGeometry(1.8, 1.38, 0.12, 4, 0.18), this.darkMat);
    bezel.position.z = 0.71;
    head.add(bezel);
    const screen = mesh(new T.PlaneGeometry(1.62, 1.215), this.screenMat);
    screen.position.z = 0.775;
    head.add(screen);
    [-1, 1].forEach((side) => {
      const ear = mesh(new T.CylinderGeometry(0.27, 0.27, 0.24, 32), this.trimMat);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(side * 1.12, 0, 0);
      head.add(ear);
    });
    const stalk = mesh(new T.CylinderGeometry(0.045, 0.045, 0.5, 12), this.darkMat);
    stalk.position.y = 1.08;
    head.add(stalk);
    this.tip = mesh(new T.SphereGeometry(0.16, 24, 16), this.glowMat);
    this.tip.position.y = 1.4;
    head.add(this.tip);

    // Body
    const neck = mesh(new T.CylinderGeometry(0.22, 0.28, 0.24, 24), this.darkMat);
    neck.position.y = -0.62;
    bot.add(neck);
    const body = mesh(new T.CapsuleGeometry(0.55, 0.38, 8, 24), this.darkMat);
    body.position.y = -1.25;
    bot.add(body);
    const chest = mesh(new T.CircleGeometry(0.15, 32), this.chestMat);
    chest.position.set(0, -1.12, 0.555);
    bot.add(chest);

    // Arms hang from shoulder pivots so they can sway and wave
    this.arms = [-1, 1].map((side) => {
      const pivot = new T.Group();
      pivot.position.set(side * 0.6, -0.95, 0);
      const arm = mesh(new T.CapsuleGeometry(0.12, 0.42, 6, 12), this.darkMat);
      arm.position.y = -0.32;
      const hand = mesh(new T.SphereGeometry(0.15, 20, 14), this.trimMat);
      hand.position.y = -0.66;
      pivot.add(arm, hand);
      pivot.rotation.z = side * 0.42;
      bot.add(pivot);
      return pivot;
    });

    // Hover thruster with a soft flame sprite
    const nozzle = mesh(new T.CylinderGeometry(0.2, 0.3, 0.22, 24), this.darkMat);
    nozzle.position.y = -1.98;
    bot.add(nozzle);
    this.flame = new T.Sprite(new T.SpriteMaterial({ map: this.flameTexture(), transparent: true, depthWrite: false }));
    this.flame.position.y = -2.38;
    this.flame.scale.set(0.75, 0.95, 1);
    bot.add(this.flame);
  }

  flameTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 24, 2, 32, 30, 30);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.25, 'rgba(110, 245, 220, 0.9)');
    g.addColorStop(0.6, 'rgba(153, 90, 242, 0.35)');
    g.addColorStop(1, 'rgba(153, 90, 242, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new this.T.CanvasTexture(canvas);
    texture.colorSpace = this.T.SRGBColorSpace;
    return texture;
  }

  applyTheme() {
    const primary = cssColor('--primary', '#995af2');
    const accent = cssColor('--accent', '#e052b1');
    const neon = cssColor('--neon', '#47ebcf');
    this.shellMat.color.setStyle(primary);
    this.trimMat.color.setStyle(accent);
    this.glowMat.color.setStyle(accent);
    this.glowMat.emissive.setStyle(accent);
    this.chestMat.color.setStyle(neon);
    this.rimLight.color.setStyle(accent);
  }

  /** Animate the model. `st` comes from the controller: motion, gaze, and one-off gestures. */
  update(dt, t, st) {
    const bob = st.still ? 0 : Math.sin(t * 2.1) * 0.09;
    let hop = 0;
    if (st.hopP >= 0 && st.hopP <= 1) hop = Math.sin(st.hopP * Math.PI) * 0.45;
    this.bot.position.y = 0.05 + bob + hop;
    this.bot.rotation.z = damp(this.bot.rotation.z, st.bank, 6, dt);
    if (st.spinP >= 0 && st.spinP <= 1) {
      this.bot.rotation.y = easeInOut(st.spinP) * Math.PI * 2;
    } else {
      this.bot.rotation.y = damp(this.bot.rotation.y % (Math.PI * 2), st.yaw, 5, dt);
    }
    this.head.rotation.y = damp(this.head.rotation.y, st.lookX * 0.45, 8, dt);
    this.head.rotation.x = damp(this.head.rotation.x, st.lookY * 0.22, 8, dt);

    const sway = st.still ? 0 : Math.sin(t * 2.1 + 1) * 0.07;
    this.arms[0].rotation.z = damp(this.arms[0].rotation.z, -0.42 - sway, 10, dt);
    const rightTarget = st.waving ? 2.55 + Math.sin(t * 12) * 0.35 : 0.42 + sway;
    this.arms[1].rotation.z = damp(this.arms[1].rotation.z, rightTarget, 10, dt);

    this.glowMat.emissiveIntensity = st.sleeping ? 0.35 : 1.1 + Math.sin(t * 3) * 0.45;
    const flicker = st.still ? 0 : Math.sin(t * 31) * 0.05;
    const thrust = 0.8 + st.speed * 0.5 + flicker;
    this.flame.scale.set(0.62 + st.speed * 0.2, 0.75 * thrust, 1);
    this.flame.position.y = -2.25 - 0.18 * thrust;
    this.flame.material.opacity = st.sleeping ? 0.45 : 0.95;

    this.face.draw(st.face);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    this.renderer.dispose();
  }
}

/* ------------------------------------------------------------------------------------------------
 * Bean: placement, flight, speech, and reactions
 * ---------------------------------------------------------------------------------------------- */

class Bean {
  constructor(THREE, RoundedBoxGeometry) {
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
    this.engine = new Engine(THREE, RoundedBoxGeometry, this.canvas, this.R);

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
    return reducedMotion || !finePointer || window.innerWidth < 768;
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
    this.s.waveUntil = performance.now() + 1800;
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

    // Poke Bean
    this.hit.addEventListener('click', () => this.poke());
    this.hit.addEventListener('pointerenter', () => { if (!this.speaking) this.setExpr('happy', 1200); });

    // Hover commentary
    let hoverTimer = 0;
    let hoverEl = null;
    document.addEventListener('pointerover', (e) => {
      if (!finePointer || this.hidden) return;
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
      this.s.waveUntil = performance.now() + 1500;
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
   * Show a speech bubble. prio 1 = unprompted (sections, hovers, idle), 2 = reactions, 3 = show/hide.
   * Returns false when the line was skipped (cooldown, a more important line is playing, or hidden).
   */
  say(text, { prio = 1, expr = 'happy', exprMs, then } = {}) {
    if (!text) return false;
    if (this.hidden && prio < 3) return false;
    if (this.dialogOpen) return false;
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

  /** Where Bean should be right now: beside the hero, above a section heading, or docked. */
  computeTarget() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const R = this.R;
    const dock = () => {
      if (this.compact) {
        // Touch / small screens: sit small beside the robot toggle at the bottom edge so Bean rarely covers content
        const scale = 0.5;
        const box = R * scale;
        return { mode: 'dock', scale, cx: 64 + box * 0.26, cy: vh - 30 - box * 0.12, section: this.visibleSection() };
      }
      const scale = 0.42;
      const box = R * scale;
      return { mode: 'dock', scale, cx: 18 + box * 0.26, cy: vh - 58 - box * 0.5, section: this.visibleSection() };
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
        return { mode: 'hero', scale, cx: tr.left - R * scale * 0.1, cy: tr.top + tr.height * 0.3, section: 'top' };
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
          if (gutter >= R * scale * 0.62) {
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
      return { mode: 'anchor', scale, cx: heading.rect.right - box * 0.08, cy: heading.rect.top - 4 - box * 0.5, section: heading.section };
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
      if (rect.top < NAV_CLEARANCE + box || rect.top > vh * 0.86) return;
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

    if (!this.target || this.frame % 3 === 0) this.target = this.computeTarget();
    const tg = this.target;
    this.mode = tg.mode;

    // Introduce each section once, the first time Bean presents it
    const section = tg.section;
    if (section && LINES.sections[section] && !this.introduced.has(section) && this.frame % 15 === 0) {
      if (this.say(pick(LINES.sections[section], `section-${section}`), { prio: 1, expr: 'happy' })) {
        this.introduced.add(section);
      }
    }

    // Spring towards the target (critically damped-ish), or snap for reduced motion
    const box = this.R * s.scale;
    const tx = clamp(tg.cx, box * 0.26 + 8, vw - box * 0.26 - 8);
    const ty = clamp(tg.cy, NAV_CLEARANCE + box * 0.35, vh - box * 0.45);
    if (reducedMotion) {
      s.cx = tx;
      s.cy = ty;
      s.scale = tg.scale;
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
    if (!s.sleeping && idleFor > SLEEP_AFTER && !this.speaking) {
      s.sleeping = true;
      s.sleptAt = now;
    }
    if (!s.sleeping && !this.speaking && now - this.lastTalk > IDLE_CHAT_AFTER && this.idleChats < 2) {
      if (this.say(pick(LINES.idle, 'idle'), { prio: 1, expr: 'neutral' })) this.idleChats += 1;
    }
    if (now > s.blinkAt) {
      s.blinkUntil = now + 130;
      s.blinkAt = now + 2200 + Math.random() * 3200;
    }

    // Gaze: follow the cursor when there is one, otherwise glance around slowly
    const headX = s.cx;
    const headY = s.cy - this.R * s.scale * 0.16;
    let lookX;
    let lookY;
    if (s.cursor && finePointer) {
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
      bank: reducedMotion ? 0 : clamp(-s.vx * 0.0005, -0.4, 0.4),
      yaw: reducedMotion ? 0 : clamp(s.vx * 0.0006, -0.5, 0.5),
      lookX,
      lookY,
      spinP: spinP <= 1 ? spinP : -1,
      hopP: hopP <= 1 ? hopP : -1,
      waving: now < s.waveUntil,
      sleeping: s.sleeping,
      speed,
      face: {
        expr,
        blink: now < s.blinkUntil && !s.sleeping && expr !== 'dizzy',
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
    const half = box * 0.26;
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
 * Boot: toggle button, lazy three.js import, and first appearance
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

(function boot() {
  if (!webglAvailable()) return;

  let hidden = storage.hidden();
  let bean = null;
  let loading = null;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'bot-toggle glass-card';
  toggle.innerHTML = '<i class="fas fa-robot text-sm" aria-hidden="true"></i>';
  const syncToggle = () => {
    toggle.setAttribute('aria-pressed', hidden ? 'false' : 'true');
    toggle.setAttribute('aria-label', hidden ? 'Show Bean, the robot guide' : 'Hide Bean, the robot guide');
    toggle.title = hidden ? 'Show Bean' : 'Hide Bean';
  };
  syncToggle();
  document.body.appendChild(toggle);

  function ensureBean() {
    if (bean) return Promise.resolve(bean);
    if (!loading) {
      loading = Promise.all([import('three'), import('three/addons/geometries/RoundedBoxGeometry.js')])
        .then(([THREE, { RoundedBoxGeometry }]) => {
          bean = new Bean(THREE, RoundedBoxGeometry);
          return bean;
        })
        .catch((err) => {
          console.warn('[Bean] could not start:', err);
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
      if (bean) bean.hide();
      return;
    }
    ensureBean().then((b) => { if (b) b.show(); });
  });

  if (hidden) return;
  whenPageReady()
    .then(whenIdle)
    .then(ensureBean)
    .then((b) => { if (b && !hidden) b.show({ greet: true }); });
})();
