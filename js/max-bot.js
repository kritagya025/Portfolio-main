/**
 * Max: the hovering robo-wolf guide for Kritagya Yadav's portfolio.
 *
 * - Lazy-loads three.js (mapped by the import map in index.html) after the page intro finishes,
 *   and only when the browser supports WebGL.
 * - An original design built in code (no model file): a helmet head with metal wolf ears and a
 *   curved LED visor showing a wolf face (heart eyes when he says hello), a floating neck ring,
 *   an egg-shaped body with a pulsing core, paw hands, a segmented tail, a hover thruster that
 *   sheds sparks, twin back boosters, and a holographic orbit ring.
 * - Flies alongside the cursor while it moves and turns his body and eyes to look at it; flies to
 *   each section heading as it scrolls into view to introduce it; hovers by the hero terminal; leads
 *   the section-transition curtain; perches at the screen edge while you read; naps when you go idle.
 * - On touch screens and narrow windows he hovers in the empty middle of the navbar instead.
 * - The robot button in the bottom-left corner hides or shows Max; the choice is remembered.
 * - Honors prefers-reduced-motion: Max holds still, does not chase the cursor, and does not type letter by letter.
 */

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
const FOLLOW_IDLE = 4500;      // stop chasing the cursor once it has been still this long
const PRESENT_MS = 4800;       // how long Max stays at a new section heading to introduce it
const NAV_CLEARANCE = 84;      // keep clear of the fixed navbar
const BOX = { desktop: 360, compact: 170 }; // size of Max's canvas in px (his on-screen scale multiplies it)

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const damp = (current, target, lambda, dt) => target + (current - target) * Math.exp(-lambda * dt);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const bezier = (a, b, c, d, u) => {
  const v = 1 - u;
  return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
};

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
  greet: () => `Good ${timeOfDay()}! I'm Max, Kritagya's robo-wolf guide.`,
  greetFollow: ["I'll fly along with your cursor. Lead the way!", 'Psst: Ctrl+K jumps anywhere on this page.'],
  curtain: (label) => [`Next stop: ${label}!`, `Thrusters on, heading to ${label}!`, `Hold tight, flying to ${label}!`],
  sections: {
    about: [
      "This is the 'who is Kritagya' part. Short version: Java, Spring Boot, lots of tests.",
      'B.Tech CSE, graduating 2027. Backend is his thing.',
    ],
    skills: [
      'His toolbox: 52 skills across 8 categories.',
      'Spring Boot, PostgreSQL, Redis, Docker... the usual suspects.',
    ],
    experience: [
      'His internship at Compass: 50 merged commits and 25+ defects fixed.',
      'Software Engineering & QA Intern at an AI travel startup. Real bugs, real fixes.',
    ],
    projects: ['Three backend builds. Click any card for the full breakdown.'],
    learning: ["What he's studying next: microservices, Kafka and Kubernetes."],
    education: ['B.Tech CSE at KCC ITM, CGPA 7.58. Plus two certifications.'],
    'github-activity': ['Live numbers straight from GitHub. Java leads the pack.'],
    contact: [
      "Here's how to reach him. Email is fastest; there's a copy button.",
      "He's open to backend roles and internships.",
    ],
  },
  hover: {
    architecture: ['The diagram lives in here. Concurrency, explained.'],
    copy: ['Copy it, paste it, say hi.'],
    resume: ['One page, all signal.', 'The PDF version of everything here.'],
    theme: () => (root.getAttribute('data-theme') === 'light' ? ['Back to night mode? Wolf hours.'] : ['Light mode? My LEDs will squint.']),
    palette: ['Psst: Ctrl+K works from anywhere.'],
    hire: ['Good call.', 'That button leads straight to his inbox.'],
    github: ['Where the source code lives.'],
    linkedin: ['The professional side of things.'],
    leetcode: ['Where the algorithms get practiced.'],
    experience: ['A 500-request burst against a limit of 10. The limit won.'],
    eventBooking: ['83 endpoints. Two kinds of locks so nobody grabs the same seat.'],
    linkpulse: ["This one's live on Render, with 39 tests behind it."],
    keyvault: ['Small service, clean layers.'],
    code: ['That @Version line? It is the whole trick.'],
    terminal: ['A terminal with good taste.'],
    languages: ['Bytes of code, not opinions. Java leads the pack.'],
  },
  skills: {
    languages: 'Java first. Always.',
    backend: 'Spring Boot territory.',
    databases: 'PostgreSQL for truth, Redis for speed.',
    security: 'JWTs, rotating refresh tokens, BCrypt, and two kinds of locks.',
    devops: 'Docker in, Render out, GitHub Actions in between.',
    testing: 'JUnit, Mockito and MockMvc keep the bugs honest.',
    tools: 'IntelliJ, Postman, Swagger, Claude Code: the daily kit.',
    core: 'The theory underneath the code.',
  },
  filters: {
    all: 'All three projects, back with the pack.',
    concurrency: "High concurrency: that's the Event Booking System.",
    devops: 'Cloud & DevOps: LinkPulse ships itself to Render.',
    security: 'Security & APIs: Event Booking and KeyVault.',
  },
  copied: ['Fetched! His email is on your clipboard.'],
  themeLight: ['Too bright! My LEDs are squinting.'],
  themeDark: ['Ahh, night mode. Wolf hours.'],
  poke: [
    'Beep-awoo! That tickles.',
    'Tip: press Ctrl+K to jump anywhere.',
    'Tip: press ? for keyboard shortcuts.',
    'Robot body, wolf heart.',
    'Running on Java and jet fuel.',
  ],
  dizzy: ["Okay, okay. I'm dizzy now."],
  idle: ['Still there? The projects are worth a sniff.', 'Psst: the Contact section has a copy-email button.'],
  wake: ["Oh! I'm up, I'm up."],
  hide: ['Powering down. The robot button wakes me up.'],
  show: ['Systems online. Max is back!'],
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
  ['.exp-card', 'experience'],
  ['[data-project-card="event-booking"]', 'eventBooking'],
  ['[data-project-card="linkpulse"]', 'linkpulse'],
  ['[data-project-card="keyvault"]', 'keyvault'],
  ['.code-card', 'code'],
  ['.hero-terminal', 'terminal'],
  ['#lang-card', 'languages'],
];
// Hovering these makes Max's eyes turn into hearts
const LOVE_HOVERS = new Set(['hire', 'copy', 'resume']);

/* ------------------------------------------------------------------------------------------------
 * Face: an LED dot matrix on Max's curved visor, showing a wolf
 * ---------------------------------------------------------------------------------------------- */

const COLS = 26;
const ROWS = 16;
const CELL = 20;
// Pattern cells: '#' bright LED, '+' dim LED, '*' heart LED, '.' off
const PAT = {
  blaze: ['+....+', '.+..+.', '..++..'],
  cheek: ['#...', '+#..', '.+#.', '+#..', '#...'],
  eye: ['###...', '#####.', '.#####', '...##.'],
  eyeHalf: ['.#####', '...##.'],
  eyeShut: ['######'],
  eyeHappy: ['.###.', '#####', '##.##', '#...#'],
  eyeBig: ['.###.', '#####', '#####', '#####', '#####', '.###.'],
  eyeSleep: ['#....#', '.####.'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  heart: ['.**.**.', '*******', '*******', '.*****.', '..***..', '...*...'],
  shades: ['########.########', '########.########', '.######...######.', '..####.....####..'],
  nose: ['######', '.####.', '..##..'],
  mouthSmile: ['#..##..#', '.##..##.'],
  mouthTalk: ['#..##..#', '.######.', '..++++..'],
  mouthGrin: ['#......#', '########', '.#++++#.', '..####..'],
  mouthO: ['.##.', '#..#', '#..#', '.##.'],
  mouthFlat: ['..##..', '######'],
  mouthWave: ['.#.#.#.', '#.#.#.#'],
  mouthSmirk: ['#..##...', '.##..###'],
};
const LED = { on: '#d1fae5', glow: '#34d399', dim: 'rgba(52, 211, 153, 0.5)', heart: '#ffe4e6', heartGlow: '#fb7185', off: '#0e1626', screen: '#03060c' };

const mirror = (pattern) => pattern.map((row) => Array.from(row).reverse().join(''));

class WolfFace {
  constructor(THREE) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = COLS * CELL;
    this.canvas.height = ROWS * CELL;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.key = '';
  }

  /** Redraws only when something changed. blink: 0 open, 1 half, 2 shut. */
  draw({ expr, dx, dy, blink, talk }) {
    const key = [expr, dx, dy, blink, talk].join();
    if (key === this.key) return;
    this.key = key;

    const cells = new Map();
    const put = (pattern, x0, y0) => {
      pattern.forEach((row, y) => Array.from(row).forEach((ch, x) => {
        if (ch !== '.') cells.set(`${x0 + x},${y0 + y}`, ch);
      }));
    };
    const at = (pattern, cx, cy) => put(pattern, Math.round(cx - pattern[0].length / 2), Math.round(cy - pattern.length / 2));

    // Eyes follow the gaze (dx, dy); the forehead blaze and snout follow at half the distance
    const mid = COLS / 2;
    const lx = mid - 4.5 + dx;
    const rx = mid + 4.5 + dx;
    const ey = 6 + dy;
    const snout = Math.round(dx / 2);
    at(PAT.blaze, mid + snout, 1.5 + Math.min(0, dy));
    let mouth = talk ? PAT.mouthTalk : PAT.mouthSmile;
    if (expr === 'love') {
      at(PAT.heart, lx - 0.5, ey);
      at(PAT.heart, rx + 0.5, ey);
    } else if (expr === 'happy') {
      at(PAT.eyeHappy, lx, ey);
      at(PAT.eyeHappy, rx, ey);
      mouth = PAT.mouthGrin;
    } else if (expr === 'surprised') {
      at(PAT.eyeBig, lx, ey - 0.5);
      at(PAT.eyeBig, rx, ey - 0.5);
      mouth = PAT.mouthO;
    } else if (expr === 'sleepy') {
      at(PAT.eyeSleep, lx, ey + 1);
      at(mirror(PAT.eyeSleep), rx, ey + 1);
      mouth = PAT.mouthFlat;
    } else if (expr === 'cool') {
      at(PAT.shades, mid, ey);
      mouth = PAT.mouthSmirk;
    } else if (expr === 'dizzy') {
      at(PAT.cross, lx, ey);
      at(PAT.cross, rx, ey);
      mouth = PAT.mouthWave;
    } else {
      const eye = blink === 2 ? PAT.eyeShut : blink === 1 ? PAT.eyeHalf : PAT.eye;
      const shift = blink ? (PAT.eye.length - eye.length) / 2 : 0;
      at(eye, lx, ey + shift);
      if (expr === 'wink') {
        at(PAT.eyeHappy, rx, ey);
        mouth = PAT.mouthGrin;
      } else {
        at(mirror(eye), rx, ey + shift);
      }
    }
    put(PAT.cheek, 1, 6 + dy);
    put(mirror(PAT.cheek), COLS - 1 - PAT.cheek[0].length, 6 + dy);
    at(PAT.nose, mid + snout, 10);
    at(mouth, mid + snout, 13 + (mouth.length > 2 ? 0.5 : 0));

    const c = this.ctx;
    c.fillStyle = LED.screen;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = cells.get(`${x},${y}`);
        const lit = ch === '#' || ch === '*';
        c.beginPath();
        c.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, lit ? 8 : ch === '+' ? 6.6 : 5, 0, Math.PI * 2);
        if (ch === '#') { c.shadowColor = LED.glow; c.shadowBlur = 18; c.fillStyle = LED.on; }
        else if (ch === '*') { c.shadowColor = LED.heartGlow; c.shadowBlur = 20; c.fillStyle = LED.heart; }
        else if (ch === '+') { c.shadowBlur = 0; c.fillStyle = LED.dim; }
        else { c.shadowBlur = 0; c.fillStyle = LED.off; }
        c.fill();
      }
    }
    c.shadowBlur = 0;
    this.texture.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Engine: Max's robot body, built from primitives: a helmet head with a curved LED visor and wolf
 * ears, a floating neck ring, an egg-shaped body with a pulsing core, paw hands, a segmented tail,
 * a hover thruster that sheds sparks, twin back boosters, and a holographic orbit ring
 * ---------------------------------------------------------------------------------------------- */

const EMERALD = 0x34d399;
const PURPLE = 0xa855f7;
const SPARKS = 48;

function glowTexture(T, rgb, elongated) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = elongated ? 160 : 64;
  const ctx = canvas.getContext('2d');
  ctx.save();
  if (elongated) ctx.scale(1, 2.5);
  const cy = elongated ? 12 : 32;
  const g = ctx.createRadialGradient(32, cy, 0, 32, cy, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.22, `rgba(${rgb}, 0.95)`);
  g.addColorStop(0.55, `rgba(${rgb}, 0.35)`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.restore();
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.minFilter = T.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

const glowSprite = (T, map, opacity) => new T.Sprite(new T.SpriteMaterial({
  map, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false,
}));

function cssColor(name) {
  const parts = getComputedStyle(root).getPropertyValue(name).trim().split(/\s+/);
  return parts.length >= 3 ? `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})` : null;
}

class Engine {
  constructor(THREE, RoomEnvironment, canvas, size) {
    const T = THREE;
    this.T = T;
    this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.setSize(size);

    this.scene = new T.Scene();
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0.55, 11);
    this.camera.lookAt(0, 0.2, 0);

    this.scene.add(new T.HemisphereLight(0xf0f4ff, 0x1e293b, 0.9));
    const key = new T.DirectionalLight(0xffffff, 1.8);
    key.position.set(3, 4, 6);
    const fill = new T.DirectionalLight(0xc7d2fe, 0.5);
    fill.position.set(-4, 1, 3);
    this.rim = new T.PointLight(PURPLE, 36, 16, 2);
    this.rim.position.set(-3, 2.5, -2.5);
    this.rim2 = new T.PointLight(EMERALD, 26, 16, 2);
    this.rim2.position.set(3, 1.2, -2.5);
    this.scene.add(key, fill, this.rim, this.rim2);

    this.face = new WolfFace(T);
    this.dotTex = glowTexture(T, '110, 231, 183', false);
    this.purpleDotTex = glowTexture(T, '192, 132, 252', false);
    this.flameTex = glowTexture(T, '110, 231, 183', true);
    this.purpleFlameTex = glowTexture(T, '192, 132, 252', true);
    this.st = { y: 0, p: 0, r: 0, blinkAt: 0, twitchAt: 0, twitchSide: 0, sw: 0, swV: 0, prevYaw: 0, sparkAt: 0 };
    this.tmp = new T.Vector3();
    this.tmp2 = new T.Vector3();
    this.camDir = new T.Vector3();
    this.mainPos = new T.Vector3();
    this.mainDir = new T.Vector3();
    this.mainPower = 0;
    this.burstCount = 0;
    this.emerald = new T.Color(EMERALD);
    this.build();
  }

  setSize(size) {
    this.renderer.setSize(size, size, false);
  }

  build() {
    const T = this.T;
    const M = {
      shell: new T.MeshPhysicalMaterial({ color: 0xe8edf5, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.14 }),
      metal: new T.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.85 }),
      green: new T.MeshStandardMaterial({ color: EMERALD, emissive: EMERALD, emissiveIntensity: 2.2, toneMapped: false }),
      purple: new T.MeshStandardMaterial({ color: PURPLE, emissive: PURPLE, emissiveIntensity: 2.4, toneMapped: false }),
      core: new T.MeshStandardMaterial({ color: PURPLE, emissive: PURPLE, emissiveIntensity: 2.6, toneMapped: false }),
      visor: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: this.face.texture, emissiveIntensity: 1.3, roughness: 0.32, metalness: 0.3, envMapIntensity: 0.3 }),
      holo: new T.MeshBasicMaterial({ color: EMERALD, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }),
    };
    this.M = M;
    const lathe = (points, segments = 48) => new T.LatheGeometry(points.map(([r, y]) => new T.Vector2(r, y)), segments);
    const mesh = (geometry, material) => new T.Mesh(geometry, material);

    this.pivot = new T.Group();
    this.scene.add(this.pivot);

    // ---- Head: helmet shell, curved LED visor, wolf ears ----
    const head = new T.Group();
    head.position.y = 1.02;
    this.pivot.add(head);
    this.head = head;
    head.add(mesh(lathe([[0, -0.66], [0.4, -0.64], [0.62, -0.54], [0.78, -0.38], [0.86, -0.18], [0.885, 0.02], [0.86, 0.22], [0.78, 0.42], [0.62, 0.58], [0.38, 0.69], [0, 0.73]]), M.shell));
    // Visor: a band of a sphere that hugs the helmet; its width/height matches the LED grid
    const VISOR_R = 0.905;
    const VISOR_ARC = 1.5;
    const VISOR_TILT = VISOR_ARC / (COLS / ROWS);
    this.visor = mesh(new T.SphereGeometry(VISOR_R, 48, 24, Math.PI / 2 - VISOR_ARC / 2, VISOR_ARC, Math.PI / 2 - VISOR_TILT / 2, VISOR_TILT), M.visor);
    head.add(this.visor);
    // Trim: glowing rails along the top and bottom edges, metal ribs at the ends
    [-1, 1].forEach((side) => {
      const ringR = VISOR_R * Math.cos(VISOR_TILT / 2);
      const turn = new T.Group();
      turn.rotation.y = -(Math.PI / 2 - VISOR_ARC / 2 - 0.03);
      turn.position.y = side * VISOR_R * Math.sin(VISOR_TILT / 2);
      const rail = mesh(new T.TorusGeometry(ringR + 0.006, 0.022, 8, 48, VISOR_ARC + 0.06), M.green);
      rail.rotation.x = Math.PI / 2;
      turn.add(rail);
      head.add(turn);
      const meridian = new T.Group();
      meridian.rotation.y = -(Math.PI / 2 - (side * VISOR_ARC) / 2);
      const rib = mesh(new T.TorusGeometry(VISOR_R + 0.006, 0.03, 8, 16, VISOR_TILT), M.metal);
      rib.rotation.z = -VISOR_TILT / 2;
      meridian.add(rib);
      head.add(meridian);
    });
    // Ears: extruded triangles with a glowing inner ear, pivoting from their base
    const earShape = new T.Shape();
    earShape.moveTo(-0.22, 0);
    earShape.quadraticCurveTo(-0.16, 0.42, -0.02, 0.78);
    earShape.quadraticCurveTo(0, 0.82, 0.02, 0.78);
    earShape.quadraticCurveTo(0.14, 0.4, 0.22, 0);
    earShape.closePath();
    const innerShape = new T.Shape();
    innerShape.moveTo(-0.11, 0.08);
    innerShape.quadraticCurveTo(-0.07, 0.34, 0, 0.56);
    innerShape.quadraticCurveTo(0.06, 0.32, 0.11, 0.08);
    innerShape.closePath();
    const earGeo = new T.ExtrudeGeometry(earShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6 });
    earGeo.translate(0, 0, -0.05);
    const innerGeo = new T.ExtrudeGeometry(innerShape, { depth: 0.02, bevelEnabled: false });
    this.ears = [-1, 1].map((side) => {
      const ear = new T.Group();
      ear.position.set(side * 0.38, 0.46, -0.04);
      ear.rotation.set(-0.1, 0, -side * 0.26);
      ear.add(mesh(earGeo, M.shell));
      const inner = mesh(innerGeo, M.green);
      inner.position.z = 0.09;
      ear.add(inner);
      head.add(ear);
      return { group: ear, side, rest: ear.rotation.clone() };
    });
    // Little sensor studs where a wolf's cheeks would be
    [-1, 1].forEach((side) => {
      const stud = mesh(new T.CylinderGeometry(0.09, 0.11, 0.06, 20), M.metal);
      stud.rotation.z = Math.PI / 2;
      stud.position.set(side * 0.88, -0.05, 0);
      head.add(stud);
      const lamp = mesh(new T.CircleGeometry(0.055, 20), M.purple);
      lamp.position.set(side * 0.915, -0.05, 0);
      lamp.rotation.y = (side * Math.PI) / 2;
      head.add(lamp);
    });

    // ---- Neck: a floating energy ring (the head hovers above the body) ----
    this.neck = mesh(new T.TorusGeometry(0.3, 0.035, 10, 40), M.green);
    this.neck.rotation.x = Math.PI / 2;
    this.neck.position.y = 0.3;
    this.pivot.add(this.neck);

    // ---- Body: egg-shaped shell with a belt line, a pulsing core, and the thrusters ----
    const body = new T.Group();
    this.pivot.add(body);
    this.body = body;
    body.add(mesh(lathe([[0.638, -0.05], [0.62, 0], [0.5, 0.12], [0.3, 0.19], [0, 0.2]]), M.shell));
    body.add(mesh(lathe([[0.24, -1.0], [0.27, -0.98], [0.4, -0.88], [0.56, -0.7], [0.665, -0.45], [0.68, -0.2], [0.638, -0.05]]), M.metal));
    // Glowing vents around the lower body (leaving the chest core clear)
    [-2.5, -1.75, -1.0, 1.0, 1.75, 2.5].forEach((angle) => {
      const vent = mesh(new T.BoxGeometry(0.035, 0.2, 0.03), M.green);
      vent.position.set(Math.sin(angle) * 0.6, -0.62, Math.cos(angle) * 0.6);
      vent.rotation.set(0.4, angle, 0, 'YXZ'); // follow the body's slope
      body.add(vent);
    });
    const belt = mesh(new T.TorusGeometry(0.638, 0.018, 8, 64), M.purple);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = -0.05;
    body.add(belt);
    const bezel = mesh(new T.TorusGeometry(0.16, 0.035, 12, 32), M.shell);
    bezel.position.set(0, -0.3, 0.64);
    body.add(bezel);
    this.core = mesh(new T.SphereGeometry(0.13, 24, 16), M.core);
    this.core.position.set(0, -0.3, 0.62);
    body.add(this.core);
    // Reactor ring spinning around the core
    this.reactor = mesh(new T.TorusGeometry(0.235, 0.012, 6, 40, Math.PI * 1.5), M.green);
    this.reactor.position.set(0, -0.3, 0.63);
    body.add(this.reactor);
    this.coreGlow = glowSprite(T, this.purpleDotTex, 0.75);
    this.coreGlow.position.set(0, -0.3, 0.72);
    this.coreGlow.scale.setScalar(0.62);
    body.add(this.coreGlow);

    // Hover thruster underneath
    const nozzle = mesh(new T.CylinderGeometry(0.26, 0.2, 0.2, 32), M.metal);
    nozzle.position.y = -1.08;
    body.add(nozzle);
    const ring = mesh(new T.TorusGeometry(0.2, 0.04, 10, 40), M.green);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.18;
    body.add(ring);
    const disc = mesh(new T.CircleGeometry(0.17, 32), M.green);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = -1.17;
    body.add(disc);

    // Jets: each has a nozzle point whose local -Y is the exhaust direction
    this.jets = [];
    const addJet = (parent, position, size, main) => {
      const point = new T.Object3D();
      point.position.copy(position);
      parent.add(point);
      const glow = glowSprite(T, main ? this.dotTex : this.purpleDotTex, 0.55);
      const flame = glowSprite(T, main ? this.flameTex : this.purpleFlameTex, 0.95);
      const core = glowSprite(T, main ? this.dotTex : this.purpleDotTex, 1);
      flame.center.set(0.5, 0.92);
      [glow, flame, core].forEach((s) => this.scene.add(s));
      this.jets.push({ point, size, main, glow, flame, core });
    };
    addJet(body, new T.Vector3(0, -1.2, 0), 0.34, true);
    // Twin back boosters, angled back and down, that fire up when Max moves fast
    [-1, 1].forEach((side) => {
      const pod = new T.Group();
      pod.position.set(side * 0.38, -0.3, -0.56);
      pod.rotation.set(1.23, 0, side * 0.22);
      pod.add(mesh(new T.CylinderGeometry(0.085, 0.12, 0.36, 20), M.metal));
      const cap = mesh(new T.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.shell);
      cap.position.y = 0.18;
      pod.add(cap);
      const podRing = mesh(new T.TorusGeometry(0.12, 0.022, 8, 28), M.purple);
      podRing.rotation.x = Math.PI / 2;
      podRing.position.y = -0.18;
      pod.add(podRing);
      body.add(pod);
      addJet(pod, new T.Vector3(0, -0.2, 0), 0.2, false);
    });

    // ---- Paws: floating hands with glowing pads ----
    this.paws = [-1, 1].map((side) => {
      const paw = new T.Group();
      const palm = mesh(new T.SphereGeometry(0.15, 24, 16), M.shell);
      palm.scale.set(1, 0.92, 0.86);
      paw.add(palm);
      const cuff = mesh(new T.TorusGeometry(0.115, 0.02, 8, 24), M.green);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.06;
      paw.add(cuff);
      [-0.06, 0, 0.06].forEach((x, i) => {
        const pad = mesh(new T.SphereGeometry(0.03, 10, 8), M.green);
        pad.position.set(x, -0.05 + (i === 1 ? -0.015 : 0), 0.12);
        paw.add(pad);
      });
      paw.position.set(side * 0.98, -0.32, 0.12);
      this.pivot.add(paw);
      return { group: paw, side };
    });

    // ---- Tail: a chain of segments that sways and trails behind ----
    this.tail = [0.11, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05].map((radius, i) => {
      const seg = mesh(new T.SphereGeometry(radius, 16, 12), i % 2 ? M.metal : M.shell);
      this.pivot.add(seg);
      return seg;
    });
    this.tailTip = glowSprite(T, this.purpleDotTex, 0.9);
    this.tailTip.scale.setScalar(0.3);
    this.pivot.add(this.tailTip);

    // ---- Holographic orbit ring with three satellites ----
    const orbit = new T.Group();
    orbit.position.y = -0.3;
    orbit.rotation.set(0.32, 0, 0.18);
    const orbitRing = mesh(new T.TorusGeometry(1.22, 0.007, 6, 96), M.holo);
    orbitRing.rotation.x = Math.PI / 2;
    orbit.add(orbitRing);
    this.satellites = [0, 1, 2].map(() => {
      const dot = mesh(new T.SphereGeometry(0.035, 10, 8), M.green);
      const halo = glowSprite(T, this.dotTex, 0.6);
      halo.scale.setScalar(0.22);
      dot.add(halo);
      orbit.add(dot);
      return dot;
    });
    this.pivot.add(orbit);
    this.orbit = orbit;

    // ---- Sparks shed by the hover thruster ----
    const positions = new Float32Array(SPARKS * 3);
    const colors = new Float32Array(SPARKS * 3);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    this.sparks = new T.Points(geo, new T.PointsMaterial({
      size: 0.09, map: this.dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
    }));
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);
    this.sparkState = Array.from({ length: SPARKS }, () => ({ life: 0, max: 1, v: new T.Vector3() }));
    this.sparkNext = 0;
  }

  /** A ring of sparks from the hover thruster, e.g. when Max lands. */
  burst(count) {
    this.burstCount = count;
  }

  applyTheme() {
    const light = root.getAttribute('data-theme') === 'light';
    const accent = cssColor('--accent');
    const primary = cssColor('--primary');
    if (accent) this.rim.color.setStyle(accent);
    if (primary) this.rim2.color.setStyle(primary);
    this.M.shell.color.set(light ? 0xdde4ee : 0xe8edf5);
    this.M.holo.opacity = light ? 0.5 : 0.32;
    this.sparks.visible = !light; // additive sparks read as grey specks on a light page
  }

  /** Where the visor is on the page, for the speech bubble (canvas = `box` px centered at cx, cy). */
  headOnPage(cx, cy, box) {
    const p = this.head.localToWorld(this.tmp.set(0, 0, 0.905)).project(this.camera);
    return { x: cx + (p.x * box) / 2, y: cy - (p.y * box) / 2 };
  }

  /**
   * Pose and draw one frame. t and dt are in ms. p: lookX/lookY (-1..1), vx/vy (px per frame),
   * expr, talk, nod, hop, spin (0..1, -1 none), wave, sleepy, boost, towing, scale (pop in/out), still.
   */
  frame(t, dt, p) {
    const k = dt / 16;
    const sec = dt / 1000;
    const st = this.st;
    const s = p.still ? 0 : 1;
    const ease = Math.min(1, 0.1 * k);

    // Body leans and turns; the head turns further, so he really looks at things
    let ty = p.sleepy ? 0 : p.lookX * 0.55;
    let tp = p.sleepy ? 0.3 : p.lookY * 0.3;
    if (p.towing) ty = -0.7;
    if (p.nod) tp += Math.sin(t / 110) * 0.25 * s;
    st.y += (ty - st.y) * ease;
    st.p += (tp - st.p) * ease;
    st.r += (clamp(-p.vx * 0.03, -0.35, 0.35) - st.r) * ease;
    const spin = p.spin >= 0 ? easeInOut(p.spin) * Math.PI * 2 : 0;
    const hop = p.hop >= 0 ? Math.sin(p.hop * Math.PI) * 0.45 : 0;
    this.pivot.scale.setScalar(Math.max(0.001, p.scale));
    this.pivot.position.y = s * (Math.sin(t / (p.sleepy ? 1100 : 650)) * 0.12 + hop) - (p.sleepy ? 0.18 : 0);
    this.pivot.rotation.set(st.p * 0.45, st.y * 0.6 + spin, st.r + s * Math.sin(t / 1100) * 0.03);
    this.head.rotation.set(st.p * 0.7, st.y * 0.6, 0);
    this.head.position.y = 1.02 + s * Math.sin(t / 650 - 0.7) * 0.035 - (p.sleepy ? 0.06 : 0);
    this.neck.scale.setScalar(1 + s * Math.sin(t / 300) * 0.04);

    // Ears: flick now and then, perk up when surprised, fold back when sleepy
    if (t > st.twitchAt) {
      st.twitchAt = t + 3200 + Math.random() * 4500;
      st.twitchSide = Math.random() < 0.5 ? -1 : 1;
    }
    const twitching = !p.still && !p.sleepy && st.twitchAt - t > 3200 - 200;
    this.ears.forEach((ear) => {
      let rx = ear.rest.x;
      let rz = ear.rest.z;
      if (p.sleepy) { rx += 0.55; rz -= ear.side * 0.25; }
      if (p.expr === 'surprised') rx -= 0.2;
      if (twitching && ear.side === st.twitchSide) rx -= 0.45;
      ear.group.rotation.x += (rx - ear.group.rotation.x) * Math.min(1, 0.25 * k);
      ear.group.rotation.z += (rz - ear.group.rotation.z) * Math.min(1, 0.25 * k);
    });

    // Paws bob beside the body; the right paw waves hello
    this.paws.forEach((paw, i) => {
      const g = paw.group;
      const phase = t / 600 + i * 1.7;
      let x = paw.side * 0.98;
      let y = -0.32 + s * Math.sin(phase) * 0.07;
      let z = 0.12;
      let roll = 0;
      if (p.wave && paw.side === 1) {
        x = 0.95;
        y = 0.45;
        z = 0.3;
        roll = Math.sin(t / 120) * 0.5;
      } else if (p.sleepy) {
        y = -0.5;
      }
      g.position.x += (x - g.position.x) * Math.min(1, 0.18 * k);
      g.position.y += (y - g.position.y) * Math.min(1, 0.18 * k);
      g.position.z += (z - g.position.z) * Math.min(1, 0.18 * k);
      g.rotation.z = roll - paw.side * 0.15 - st.r * 0.6;
    });

    // Tail sways with movement and turning
    const yaw = st.y * 0.6 + spin;
    st.swV += (-st.sw * 0.08 - (yaw - st.prevYaw) * 2 - p.vx * 0.004) * k;
    st.swV *= 0.9;
    st.sw += st.swV * 0.12 * k;
    st.prevYaw = yaw;
    let tx = 0;
    let ty2 = -0.62;
    let tz = -0.58;
    let up = 0.15;
    const wag = s * Math.sin(t / (p.expr === 'happy' || p.expr === 'love' ? 140 : 420)) * (p.expr === 'happy' || p.expr === 'love' ? 0.35 : 0.15) + st.sw * 0.8;
    this.tail.forEach((seg, i) => {
      seg.position.set(tx, ty2, tz);
      const step = 0.12;
      up += p.sleepy ? -0.05 : 0.16;
      const side = wag * (i + 1) * 0.12;
      tx += Math.sin(side) * step;
      ty2 += Math.sin(up) * step;
      tz -= Math.cos(up) * Math.cos(side) * step;
    });
    this.tailTip.position.set(tx, ty2, tz);

    // Core pulses between purple and emerald; orbit ring spins
    const pulse = 0.5 + 0.5 * Math.sin(t / 700);
    this.M.core.emissive.setHex(PURPLE).lerp(this.emerald, pulse * 0.6);
    this.M.core.emissiveIntensity = p.sleepy ? 1 : 2.2 + pulse;
    this.coreGlow.material.opacity = p.sleepy ? 0.35 : 0.55 + pulse * 0.35;
    this.orbit.rotation.y += sec * (p.sleepy ? 0.15 : 0.6) * s;
    this.reactor.rotation.z -= sec * (p.sleepy ? 0.6 : 2.4) * s;
    this.satellites.forEach((dot, i) => {
      const a = t / 1400 * s + (i * Math.PI * 2) / 3;
      dot.position.set(Math.cos(a) * 1.22, 0, Math.sin(a) * 1.22);
    });

    // Face
    if (t > st.blinkAt) st.blinkAt = t + 2200 + Math.random() * 2600;
    const bt = st.blinkAt - t;
    this.face.draw({
      expr: p.expr,
      dx: Math.round(p.lookX * 2),
      dy: Math.round(p.lookY * 1.5),
      blink: p.still ? 0 : bt < 170 ? (bt > 120 || bt < 40 ? 1 : 2) : 0,
      talk: p.talk,
    });

    // Thruster flames, oriented along each nozzle's exhaust direction as seen by the camera
    this.pivot.updateMatrixWorld(true);
    this.camera.getWorldDirection(this.camDir);
    const speed = Math.hypot(p.vx, p.vy);
    const boosters = clamp((speed - 4) * 0.08, 0, 1) + (p.towing ? 0.8 : 0);
    this.jets.forEach((jet) => {
      const pos = jet.point.getWorldPosition(this.tmp);
      const dir = this.tmp2.set(0, -1, 0).transformDirection(jet.point.matrixWorld);
      const a = pos.clone().project(this.camera);
      const b = pos.clone().add(dir).project(this.camera);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const fore = Math.sqrt(Math.max(0.12, 1 - Math.pow(dir.dot(this.camDir), 2)));
      const power = jet.main
        ? (p.sleepy ? 0.45 : p.boost * (1 + Math.min(0.6, speed * 0.04)))
        : boosters;
      const flicker = power * (p.still ? 1 : 0.82 + Math.random() * 0.3);
      const w = jet.size * p.scale;
      const visible = p.scale > 0.05 && power > 0.02;
      jet.glow.visible = jet.flame.visible = jet.core.visible = visible;
      if (!visible) return;
      jet.glow.position.copy(pos);
      jet.flame.position.copy(pos);
      jet.core.position.copy(pos);
      jet.flame.material.rotation = angle + Math.PI / 2;
      jet.flame.scale.set(w, w * 4 * fore * flicker, 1);
      jet.glow.scale.setScalar(w * 2.2 * Math.min(1, 0.4 + power));
      jet.core.scale.setScalar(w * 0.75);
      if (jet.main) {
        this.mainPos.copy(pos);
        this.mainDir.copy(dir);
        this.mainPower = power;
      }
    });

    // Sparks: emitted from the hover thruster, falling and fading
    const posAttr = this.sparks.geometry.attributes.position;
    const colAttr = this.sparks.geometry.attributes.color;
    while (this.burstCount > 0 && !p.still) {
      this.burstCount -= 1;
      const i = this.sparkNext;
      const spark = this.sparkState[i];
      this.sparkNext = (i + 1) % SPARKS;
      spark.life = spark.max = 0.5 + Math.random() * 0.45;
      const a = Math.random() * Math.PI * 2;
      spark.v.set(Math.cos(a) * (1.4 + Math.random()), -0.3 - Math.random() * 0.9, Math.sin(a) * (1.4 + Math.random()));
      posAttr.setXYZ(i, this.mainPos.x, this.mainPos.y, this.mainPos.z);
    }
    if (!p.still && t > st.sparkAt && this.mainPower > 0.3 && p.scale > 0.5) {
      st.sparkAt = t + 70 / this.mainPower;
      const i = this.sparkNext;
      const spark = this.sparkState[i];
      this.sparkNext = (i + 1) % SPARKS;
      spark.life = spark.max = 0.45 + Math.random() * 0.35;
      spark.v.copy(this.mainDir).multiplyScalar(1.4 + Math.random()).add(this.tmp2.set((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9));
      posAttr.setXYZ(i, this.mainPos.x, this.mainPos.y, this.mainPos.z);
    }
    this.sparkState.forEach((spark, i) => {
      if (spark.life <= 0) { colAttr.setXYZ(i, 0, 0, 0); return; }
      spark.life -= sec;
      spark.v.y -= sec * 1.5;
      posAttr.setXYZ(i, posAttr.getX(i) + spark.v.x * sec, posAttr.getY(i) + spark.v.y * sec, posAttr.getZ(i) + spark.v.z * sec);
      const f = Math.max(0, spark.life / spark.max);
      colAttr.setXYZ(i, 0.43 * f, 0.9 * f, 0.72 * f);
    });
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.sparks.material.size = 0.09 * Math.max(0.2, p.scale);

    this.renderer.render(this.scene, this.camera);
  }
}

/* ------------------------------------------------------------------------------------------------
 * Max: placement, flight, speech, expressions, and reactions
 * ---------------------------------------------------------------------------------------------- */

class Max {
  constructor(THREE, RoomEnvironment) {
    this.layer = document.createElement('div');
    this.layer.className = 'bot-layer is-hidden';
    this.layer.setAttribute('aria-hidden', 'true');
    this.bubble = document.createElement('div');
    this.bubble.className = 'bot-bubble tail-left';
    this.bubbleText = document.createElement('span');
    this.bubble.appendChild(this.bubbleText);
    this.zzz = document.createElement('div');
    this.zzz.className = 'bot-zzz';
    this.zzz.innerHTML = '<span>z</span><span>z</span><span>z</span>';
    this.body = document.createElement('div');
    this.body.className = 'bot-body';
    this.canvas = document.createElement('canvas');
    // Only Max himself is clickable, not the transparent space around him
    this.hit = document.createElement('div');
    this.hit.className = 'bot-hit';
    this.body.append(this.canvas, this.hit);
    this.layer.append(this.bubble, this.zzz, this.body);
    document.body.appendChild(this.layer);

    this.compact = this.isCompact();
    this.R = this.compact ? BOX.compact : BOX.desktop;
    this.layer.classList.toggle('is-compact', this.compact);
    this.body.style.width = this.body.style.height = `${this.R}px`;
    this.engine = new Engine(THREE, RoomEnvironment, this.canvas, this.R);
    this.engine.applyTheme();

    const now = performance.now();
    this.s = {
      cx: -this.R, cy: window.innerHeight * 0.4, vx: 0, vy: 0, scale: 0.6, pop: 0,
      expr: 'idle', exprUntil: 0, spinFrom: -1e9, hopFrom: -1e9, nodUntil: 0, waveUntil: 0,
      cursor: null, cursorMovedAt: -1e9, lastInput: now, sleeping: false, sleptAt: 0,
      pokes: 0, pokeAt: 0,
    };
    this.target = null;
    this.mode = 'hero';
    this.presenting = null;       // { section, until, said } while introducing a heading
    this.entry = null;            // the flying entrance while it plays
    this.curtain = null;          // 'tow' while leading the section curtain in, 'hold' while it covers the page
    this.petting = false;         // pointer is over Max: hold still so he can be clicked
    this.hidden = true;
    this.dialogOpen = false;
    this.speaking = false;
    this.typing = false;
    this.speakingPrio = 0;
    this.lastUnprompted = -1e9;
    this.lastTalk = now;
    this.idleChats = 0;
    this.introduced = new Set();
    this.hoverCooldowns = new Map();
    this.lastSkillAt = 0;
    this.bubbleW = 0;
    this.bubbleH = 0;
    this.frame = 0;
    this.last = now;
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
    const now = performance.now();
    this.target = this.computeTarget(now);
    this.greetOnArrival = greet;
    const s = this.s;
    s.scale = this.target.scale;
    s.vx = s.vy = 0;
    s.pop = 1;
    this.start();
    if (reducedMotion) {
      s.cx = this.target.cx;
      s.cy = this.target.cy;
      this.arrive(now);
      return;
    }
    // Flying entrance: launch from below the screen, swoop high across it with a barrel roll at the top
    // of the arc, then glide into place. The path's end follows the live target, so he always lands right.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = this.R * this.target.scale;
    if (this.compact) {
      this.entry = { start: now, dur: 1600, from: { x: vw * 0.85, y: vh + box }, c1: { x: vw * 0.1, y: vh * 0.6 }, c2: { dx: vw * 0.35, dy: vh * 0.25 } };
    } else {
      this.entry = { start: now, dur: 2400, from: { x: -box * 0.6, y: vh + box * 0.5 }, c1: { x: vw * 0.28, y: -vh * 0.05 }, c2: { dx: box * 1.1, dy: -box * 0.9 } };
    }
    this.entry.scale0 = this.target.scale * 0.55;
    s.cx = this.entry.from.x;
    s.cy = this.entry.from.y;
    s.scale = this.entry.scale0;
    s.spinFrom = now + this.entry.dur * 0.2;
    this.setExpr('cool', this.entry.dur);
  }

  /** Touchdown after the entrance: a little hop, a burst of sparks, then hello (heart eyes on page load). */
  arrive(now) {
    const s = this.s;
    if (!reducedMotion) s.hopFrom = now;
    this.engine.burst(20);
    if (this.greetOnArrival) {
      this.setExpr('love', 4200);
      s.waveUntil = now + 3000;
      setTimeout(() => this.greet(), reducedMotion ? 200 : 350);
    } else {
      s.waveUntil = now + 1600;
      this.say(pick(LINES.show, 'show'), { prio: 3, expr: 'happy' });
    }
  }

  hide() {
    this.entry = null;
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
    this.say(greeting, { prio: 2, expr: 'love', exprMs: 3600 });
    const followDelay = (reducedMotion ? 0 : greeting.length * 24) + 2600;
    setTimeout(() => {
      if (this.compact) this.say(LINES.greetFollow[1], { prio: 2, expr: 'happy' });
      else if (this.mode === 'hero' || this.mode === 'follow') this.say(pick(LINES.greetFollow, 'greetFollow'), { prio: 2, expr: 'happy' });
    }, followDelay);
  }

  /* ---- page wiring ---- */

  bind() {
    const markInput = () => {
      const s = this.s;
      const now = performance.now();
      if (s.sleeping) {
        s.sleeping = false;
        if (now - s.sleptAt > 5000) {
          if (!reducedMotion) s.hopFrom = now;
          this.say(pick(LINES.wake, 'wake'), { prio: 2, expr: 'surprised', exprMs: 1200 });
        }
      }
      s.lastInput = now;
    };

    window.addEventListener('pointermove', (e) => {
      const s = this.s;
      if (!s.cursor || Math.abs(e.clientX - s.cursor.x) + Math.abs(e.clientY - s.cursor.y) > 3) s.cursorMovedAt = performance.now();
      s.cursor = { x: e.clientX, y: e.clientY };
      markInput();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { this.s.cursorMovedAt = -1e9; });
    window.addEventListener('scroll', markInput, { passive: true });
    window.addEventListener('keydown', markInput);
    window.addEventListener('touchstart', markInput, { passive: true });

    window.addEventListener('resize', () => {
      const compact = this.isCompact();
      if (compact === this.compact) return;
      this.compact = compact;
      this.R = compact ? BOX.compact : BOX.desktop;
      this.layer.classList.toggle('is-compact', compact);
      this.body.style.width = this.body.style.height = `${this.R}px`;
      this.engine.setSize(this.R);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else if (!this.hidden) this.start();
    });

    // Pat Max: he holds still and smiles while the pointer is on him
    this.hit.addEventListener('pointerenter', () => {
      this.petting = true;
      if (!this.speaking) this.setExpr('happy', 1200);
    });
    this.hit.addEventListener('pointerleave', () => { this.petting = false; });
    this.hit.addEventListener('click', () => this.poke());

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
        const expr = LOVE_HOVERS.has(match.key) ? 'love' : 'happy';
        if (this.say(pick(source, `hover-${match.key}`), { prio: 1, expr })) this.hoverCooldowns.set(match.key, performance.now());
      }, HOVER_DWELL);
    });
    document.addEventListener('pointerout', (e) => {
      if (!hoverEl || (e.relatedTarget && hoverEl.contains(e.relatedTarget))) return;
      hoverEl = null;
      clearTimeout(hoverTimer);
    });

    // Section transitions: lead the curtain in, wait while it covers the page, then carry on
    document.addEventListener('ky:curtain', (e) => {
      if (this.hidden || this.compact) return;
      const { phase, label, id } = e.detail;
      if (phase === 'start') {
        this.curtain = 'tow';
        this.presenting = null;
        this.s.sleeping = false;
        this.say(pick(LINES.curtain(label), 'curtain'), { prio: 3, expr: 'cool' });
      } else if (phase === 'covered') {
        this.curtain = 'hold';
        this.setExpr('happy', 1400);
      } else if ((phase === 'reveal' || phase === 'end') && this.curtain) {
        // Take off as the curtain wipes away, then introduce the section he just led you to
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
      if (!reducedMotion) this.s.hopFrom = performance.now();
      this.say(pick(LINES.copied, 'copied'), { prio: 2, expr: 'love' });
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

  /* ---- speech and expressions ---- */

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

  /**
   * Where Max should fly right now, in priority order: leading the curtain, introducing a new
   * section heading, following the moving cursor, hovering by the hero terminal, napping in the
   * corner, or perching at the nearest screen edge while you read.
   */
  computeTarget(now) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const R = this.R;
    const s = this.s;

    if (this.curtain) {
      const scale = 0.8;
      const box = R * scale;
      const rest = box * 0.3 + 12;
      if (this.curtain === 'tow') {
        const curtainEl = document.getElementById('section-curtain');
        const left = curtainEl ? curtainEl.getBoundingClientRect().left : 0;
        return { mode: 'tow', scale, cx: Math.max(rest, left - box * 0.12), cy: vh * 0.55, snap: true };
      }
      return { mode: 'hold', scale, cx: rest, cy: vh * 0.55 };
    }

    if (this.compact) {
      // Phones / small windows: hover in the empty middle of the navbar so content stays clear
      const nav = document.getElementById('nav-inner');
      const nr = nav ? nav.getBoundingClientRect() : null;
      const scale = 0.72;
      if (nr && nr.width > 0) {
        return { mode: 'dock', scale, cx: nr.left + nr.width * 0.47, cy: nr.top + nr.height * 0.5, section: this.visibleSection(), free: true };
      }
      return { mode: 'dock', scale, cx: 90, cy: vh - 50, section: this.visibleSection() };
    }

    // A section heading just scrolled into view: fly over and introduce it
    const heading = this.presentableEyebrow(R * 0.66, vh);
    if (!this.presenting && heading && LINES.sections[heading.section] && !this.introduced.has(heading.section) && !s.sleeping) {
      this.presenting = { section: heading.section, until: now + PRESENT_MS, said: false };
    }
    if (this.presenting) {
      if (now > this.presenting.until || !heading || heading.section !== this.presenting.section) {
        this.introduced.add(this.presenting.section);
        this.presenting = null;
      } else {
        const scale = 0.66;
        const box = R * scale;
        return { mode: 'present', scale, cx: heading.rect.right + box * 0.34 + 10, cy: heading.rect.top + heading.rect.height / 2 - box * 0.06, section: heading.section, lookAt: heading.rect };
      }
    }

    // Follow the cursor while it is moving (and hold still while it is on Max, so he can be patted).
    // Not while it is up in the navbar: he would only hover over the headings below it.
    const cursorInPage = s.cursor && s.cursor.y > NAV_CLEARANCE;
    if (cursorInPage && !s.sleeping && (this.petting || now - s.cursorMovedAt < FOLLOW_IDLE)) {
      const scale = 0.8;
      if (this.petting) return { mode: 'follow', scale, cx: s.cx, cy: s.cy };
      const box = R * scale;
      const gap = box * 0.26 + 36;
      const side = s.cursor.x + gap + box * 0.3 < vw - 8 ? 1 : -1;
      return { mode: 'follow', scale, cx: s.cursor.x + side * gap, cy: s.cursor.y - box * 0.04 };
    }

    // Hero, cursor at rest: hover beside the terminal (or in the open space on the right)
    const hero = document.getElementById('top');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    if (heroRect && heroRect.bottom > vh * 0.55) {
      const terminal = document.querySelector('.hero-terminal');
      const tr = terminal ? terminal.getBoundingClientRect() : null;
      if (tr && tr.width > 0) {
        const scale = 0.95;
        return { mode: 'hero', scale, cx: tr.left - R * scale * 0.22, cy: tr.top + R * scale * 0.08 };
      }
      return { mode: 'hero', scale: 1, cx: vw - Math.max(190, vw * 0.18), cy: vh * 0.45 + heroRect.top * 0.6 };
    }

    // Napping: settle in the bottom-left corner beside the robot button
    if (s.sleeping) {
      const scale = 0.55;
      return { mode: 'dock', scale, cx: 64 + R * scale * 0.3, cy: vh - 24 - R * scale * 0.32 };
    }

    // Reading: perch at the nearest screen edge, at the height he was
    const scale = 0.62;
    const box = R * scale;
    const edge = s.cx < vw / 2 ? box * 0.3 + 16 : vw - box * 0.3 - 16;
    return { mode: 'rest', scale, cx: edge, cy: s.cy };
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
      if (rect.top < NAV_CLEARANCE + box * 0.25 || rect.top > vh * 0.82) return;
      const score = Math.abs(rect.top - vh * 0.5);
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
    const dtMs = Math.min(50, Math.max(1, now - this.last));
    const dt = dtMs / 1000;
    this.last = now;
    this.frame += 1;
    const s = this.s;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!this.target || this.curtain || this.frame % 2 === 0) this.target = this.computeTarget(now);
    const tg = this.target;
    this.mode = tg.mode;

    // Fly: ride the curtain edge exactly, otherwise a soft spring (looser while following the cursor)
    const box = this.R * s.scale;
    const tx = tg.snap || tg.free ? tg.cx : clamp(tg.cx, box * 0.3 + 8, vw - box * 0.3 - 8);
    const ty = tg.free ? tg.cy : clamp(tg.cy, NAV_CLEARANCE + box * 0.34, vh - box * 0.32);
    if (this.entry) {
      // Flying entrance: fast launch, gliding finish along a curve that ends at the live target
      const e = this.entry;
      const raw = Math.min(1, (now - e.start) / e.dur);
      const u = 1 - Math.pow(1 - raw, 3);
      const x = bezier(e.from.x, e.c1.x, tx + e.c2.dx, tx, u);
      const y = bezier(e.from.y, e.c1.y, Math.max(-box * 0.2, ty + e.c2.dy), ty, u);
      s.vx = (x - s.cx) / dt;
      s.vy = (y - s.cy) / dt;
      s.cx = x;
      s.cy = y;
      s.scale = e.scale0 + (tg.scale - e.scale0) * u;
      if (raw >= 1) {
        this.entry = null;
        s.vx = s.vy = 0;
        this.arrive(now);
      }
    } else if (reducedMotion) {
      s.cx = tx;
      s.cy = ty;
      s.scale = tg.scale;
      s.vx = s.vy = 0;
    } else if (tg.snap) {
      s.vx = (tx - s.cx) / dt;
      s.vy = damp(s.vy, 0, 10, dt);
      s.cx = tx;
      s.cy = damp(s.cy, ty, 8, dt);
      s.scale = damp(s.scale, tg.scale, 8, dt);
    } else {
      const k = tg.mode === 'follow' ? 12 : 18;
      const c = 2 * Math.sqrt(k) * 0.95;
      s.vx += (k * (tx - s.cx) - c * s.vx) * dt;
      s.vy += (k * (ty - s.cy) - c * s.vy) * dt;
      s.cx += s.vx * dt;
      s.cy += s.vy * dt;
      s.scale = damp(s.scale, tg.scale, 5, dt);
    }
    s.pop = damp(s.pop, 1, 7, dt);
    const R = this.R;
    this.body.style.transform = `translate3d(${(s.cx - R / 2).toFixed(1)}px, ${(s.cy - R / 2).toFixed(1)}px, 0) scale(${s.scale.toFixed(3)})`;

    // Introduce the section once he has arrived at its heading (with a nod)
    if (this.presenting && !this.presenting.said && tg.mode === 'present' && Math.hypot(tx - s.cx, ty - s.cy) < 60) {
      if (this.say(pick(LINES.sections[this.presenting.section], `section-${this.presenting.section}`), { prio: 2, expr: 'happy' })) {
        this.presenting.said = true;
        this.introduced.add(this.presenting.section);
        s.nodUntil = now + 700;
      }
    }
    // On small screens Max stays in the navbar, so introduce sections as they come into view
    if (this.compact && tg.section && LINES.sections[tg.section] && !this.introduced.has(tg.section) && this.frame % 15 === 0) {
      if (this.say(pick(LINES.sections[tg.section], `section-${tg.section}`), { prio: 1, expr: 'happy' })) this.introduced.add(tg.section);
    }

    // Mood: nap after a long idle, chat a little when the visitor has been quiet
    const idleFor = now - s.lastInput;
    if (!s.sleeping && idleFor > SLEEP_AFTER && !this.speaking && !this.curtain && !this.presenting) {
      s.sleeping = true;
      s.sleptAt = now;
    }
    if (!s.sleeping && !this.speaking && !this.curtain && now - this.lastTalk > IDLE_CHAT_AFTER && this.idleChats < 2) {
      if (this.say(pick(LINES.idle, 'idle'), { prio: 1, expr: 'idle' })) this.idleChats += 1;
    }

    // Gaze: body and eyes turn towards the cursor; towards the heading while presenting
    const head = this.engine.headOnPage(s.cx, s.cy, box);
    let lookX = 0;
    let lookY = 0;
    if (this.entry) {
      lookX = clamp(s.vx / 900, -1, 1);
      lookY = clamp(s.vy / 1200, -1, 1);
    } else if (this.curtain === 'tow') {
      lookX = -1;
    } else if (tg.lookAt) {
      lookX = clamp((tg.lookAt.left + tg.lookAt.width / 2 - head.x) / (vw * 0.3), -1, 1);
      lookY = clamp((tg.lookAt.top - head.y) / (vh * 0.35), -1, 1);
    } else if (s.cursor && finePointer && !reducedMotion) {
      lookX = clamp((s.cursor.x - head.x) / (vw * 0.25), -1, 1);
      lookY = clamp((s.cursor.y - head.y) / (vh * 0.3), -1, 1);
    } else if (!reducedMotion) {
      lookX = Math.sin(now / 2800) * 0.4;
      lookY = Math.sin(now / 4300) * 0.2;
    }
    if (s.sleeping) { lookX = 0; lookY = 0.3; }

    const expr = s.sleeping ? 'sleepy' : now < s.exprUntil ? s.expr : 'idle';
    const spinP = reducedMotion ? -1 : (now - s.spinFrom) / 800;
    const hopP = reducedMotion ? -1 : (now - s.hopFrom) / 520;
    this.engine.frame(now, dtMs, {
      lookX,
      lookY,
      vx: s.vx / 60,
      vy: s.vy / 60,
      expr,
      talk: this.typing && (expr === 'idle' || expr === 'happy') && Math.floor(now / 110) % 2 === 0,
      nod: now < s.nodUntil,
      wave: !reducedMotion && now < s.waveUntil,
      hop: hopP <= 1 ? hopP : -1,
      spin: spinP <= 1 ? spinP : -1,
      sleepy: s.sleeping,
      boost: this.entry ? 2.2 : this.curtain === 'tow' ? 1.6 : 1,
      towing: this.curtain === 'tow',
      scale: s.pop,
      still: reducedMotion,
    });

    // Speech bubble beside his face, and "zzz" while he naps
    if (this.bubble.classList.contains('is-visible')) this.placeBubble(head.x, head.y, box, vw, vh);
    this.zzz.classList.toggle('is-visible', s.sleeping && !this.hidden);
    if (s.sleeping) this.zzz.style.transform = `translate3d(${(head.x + box * 0.12).toFixed(1)}px, ${(head.y - box * 0.3).toFixed(1)}px, 0)`;
  }

  placeBubble(headX, headY, box, vw, vh) {
    const half = box * 0.2;
    const bw = this.bubbleW;
    const bh = this.bubbleH;
    let left;
    let tail;
    // Keep the bubble on the side away from the cursor so it never sits under the pointer
    const cursorLeft = this.s.cursor && this.s.cursor.x < headX;
    const preferRight = !cursorLeft || this.compact;
    const fitsRight = headX + half + 12 + bw <= vw - 8;
    const fitsLeft = headX - half - 12 - bw >= 8;
    if ((preferRight && fitsRight) || !fitsLeft) {
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
  const [THREE, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  return new Max(THREE, RoomEnvironment);
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
