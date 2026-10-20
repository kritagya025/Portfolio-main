/**
 * Max: the floating robot guide (with a wolf face) for Kritagya Yadav's portfolio.
 *
 * - Lazy-loads three.js (mapped by the import map in index.html) and his model after the page
 *   intro finishes, and only when the browser supports WebGL.
 * - Model: "Flying Robot 07" by Konstantin_Dem (Sketchfab), CC BY 4.0, optimized/modified; the same
 *   robot the reference design uses. His screen shows an LED dot-matrix wolf face: pointed ears,
 *   slanted eyes, a snout, and heart eyes when he says hello.
 * - Flies alongside the cursor while it moves and turns his body and eyes to look at it; flies to
 *   each section heading as it scrolls into view to introduce it; hovers by the hero terminal; leads
 *   the section-transition curtain; perches at the screen edge while you read; naps when you go idle.
 * - On touch screens and narrow windows he hovers in the empty middle of the navbar instead.
 * - The robot button in the bottom-left corner hides or shows Max; the choice is remembered.
 * - Honors prefers-reduced-motion: Max holds still, does not chase the cursor, and does not type letter by letter.
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
const FOLLOW_IDLE = 4500;      // stop chasing the cursor once it has been still this long
const PRESENT_MS = 4800;       // how long Max stays at a new section heading to introduce it
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
 * Face: a 24×24 LED dot matrix (like the reference robot's) showing a wolf
 * ---------------------------------------------------------------------------------------------- */

const GRID = 24;
const CELL = 20;
// Pattern cells: '#' bright LED, '+' dim LED, '*' heart LED, '.' off
const PAT = {
  ear: ['#.......', '##......', '#+#.....', '#++#....', '#+++#...', '#++++#..', '#+++++#.'],
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
const LED = { on: '#d1fae5', glow: '#34d399', dim: 'rgba(52, 211, 153, 0.5)', heart: '#ffe4e6', heartGlow: '#fb7185', off: '#121a2b', screen: '#05080f' };

const mirror = (pattern) => pattern.map((row) => Array.from(row).reverse().join(''));

class WolfFace {
  constructor(THREE) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = GRID * CELL;
    this.canvas.height = GRID * CELL;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.key = '';
  }

  /** Redraws only when something changed. blink: 0 open, 1 half, 2 shut. twitch: 0, 1 left ear, 2 right ear. */
  draw({ expr, dx, dy, blink, talk, twitch }) {
    const key = [expr, dx, dy, blink, talk, twitch].join();
    if (key === this.key) return;
    this.key = key;

    const cells = new Map();
    const put = (pattern, x0, y0) => {
      pattern.forEach((row, y) => Array.from(row).forEach((ch, x) => {
        if (ch !== '.') cells.set(`${x0 + x},${y0 + y}`, ch);
      }));
    };
    const at = (pattern, cx, cy) => put(pattern, Math.round(cx - pattern[0].length / 2), Math.round(cy - pattern.length / 2));

    // Ears droop while sleepy and flick now and then
    const droop = expr === 'sleepy' ? 1 : 0;
    put(PAT.ear, 1, droop + (twitch === 1 ? 1 : 0));
    put(mirror(PAT.ear), GRID - 1 - PAT.ear[0].length, droop + (twitch === 2 ? 1 : 0));

    // Eyes follow the gaze (dx, dy); the snout follows at half the distance
    const lx = 7 + dx;
    const rx = 17 + dx;
    const ey = 10.5 + dy;
    const snout = Math.round(dx / 2);
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
      at(PAT.shades, 12, ey);
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
    put(PAT.cheek, 0, 13 + dy);
    put(mirror(PAT.cheek), GRID - PAT.cheek[0].length, 13 + dy);
    at(PAT.nose, 12 + snout, 16);
    at(mouth, 12 + snout, 19 + (mouth.length > 2 ? 0.5 : 0));

    const c = this.ctx;
    c.fillStyle = LED.screen;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const ch = cells.get(`${x},${y}`);
        const lit = ch === '#' || ch === '*';
        c.beginPath();
        c.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, lit ? 8 : ch === '+' ? 6.6 : 5.2, 0, Math.PI * 2);
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
 * Engine: three.js scene around the glTF robot (thruster flames, wobbling antennas, swinging cables)
 * ---------------------------------------------------------------------------------------------- */

const MODEL_HEIGHT = 3.4;
// Light intensities for three r155+ (physical units)
const LIGHTS = { hemi: 1.6, key: 2.6, fill: 0.9, rim: 40 };

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

/** Rebuilds the screen's UVs from its camera-facing projection so the face always fills it upright. */
function remapScreenUVs(T, mesh) {
  const pos = mesh.geometry.attributes.position;
  const v = new T.Vector3();
  const xs = new Float32Array(pos.count);
  const ys = new Float32Array(pos.count);
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    xs[i] = v.x;
    ys[i] = v.y;
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  const pad = 0.04;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pad + (1 - 2 * pad) * (xs[i] - x0) / (x1 - x0 || 1);
    uv[i * 2 + 1] = pad + (1 - 2 * pad) * (ys[i] - y0) / (y1 - y0 || 1);
  }
  mesh.geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
}

function cssColor(name) {
  const parts = getComputedStyle(root).getPropertyValue(name).trim().split(/\s+/);
  return parts.length >= 3 ? `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})` : null;
}

class Engine {
  constructor(THREE, gltf, canvas, size) {
    const T = THREE;
    this.T = T;
    this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.setSize(size);

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0.35, 11);
    this.camera.lookAt(0, -0.15, 0);
    this.scene.add(new T.HemisphereLight(0xf0eeff, 0x1e293b, LIGHTS.hemi));
    const key = new T.DirectionalLight(0xffffff, LIGHTS.key);
    key.position.set(3, 4, 6);
    const fill = new T.DirectionalLight(0xc9c4ff, LIGHTS.fill);
    fill.position.set(-4, 1, 3);
    this.rim = new T.PointLight(0xa855f7, LIGHTS.rim, 16, 2);
    this.rim.position.set(-3, 2.5, -2.5);
    this.rim2 = new T.PointLight(0x34d399, LIGHTS.rim * 0.6, 16, 2);
    this.rim2.position.set(3, 1.5, -2.5);
    this.scene.add(key, fill, this.rim, this.rim2);

    this.pivot = new T.Group();
    this.scene.add(this.pivot);
    this.face = new WolfFace(T);

    // Thruster flames: glow + elongated flame + bright core per jet, placed in world space each frame
    const flameTex = glowTexture(T, '110, 231, 183', true);
    const dotTex = glowTexture(T, '110, 231, 183', false);
    this.flames = [0, 1].map(() => {
      const glow = glowSprite(T, dotTex, 0.5);
      const flame = glowSprite(T, flameTex, 0.95);
      const core = glowSprite(T, dotTex, 1);
      flame.center.set(0.5, 0.92);
      [glow, flame, core].forEach((s) => { s.visible = false; this.scene.add(s); });
      return { glow, flame, core };
    });
    this.jets = [];
    this.wobblers = [];
    this.st = { y: 0, p: 0, r: 0, blinkAt: 0, twitchAt: 0, twitchSide: 1, prevY: 0, prevYaw: 0, sw: 0, swV: 0 };
    this.tmp = new T.Vector3();
    this.camDir = new T.Vector3();
    this.dirW = new T.Vector3();
    this.q = new T.Quaternion();
    this.eu = new T.Euler();
    this.mount(gltf);
  }

  setSize(size) {
    this.renderer.setSize(size, size, false);
  }

  /** Center and size the robot, turn its screen to the camera, put the wolf face on it, find the jets. */
  mount(gltf) {
    const T = this.T;
    const holder = new T.Group();
    const inner = new T.Group();
    holder.add(inner);
    inner.add(gltf.scene);
    this.pivot.add(holder);

    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const name = (m) => `${m.name} ${m.parent ? m.parent.name : ''}`;

    const screen = meshes.find((m) => /screen|plane.?001/i.test(name(m)));
    holder.updateMatrixWorld(true);
    let box = new T.Box3().setFromObject(inner);
    if (screen) {
      const screenCenter = new T.Box3().setFromObject(screen).getCenter(new T.Vector3());
      if (screenCenter.z < box.getCenter(new T.Vector3()).z) inner.rotation.y = Math.PI;
    }
    holder.updateMatrixWorld(true);
    box = new T.Box3().setFromObject(inner);
    const size = box.getSize(new T.Vector3());
    const scale = MODEL_HEIGHT / size.y;
    holder.scale.setScalar(scale);
    holder.position.copy(box.getCenter(new T.Vector3())).multiplyScalar(-scale);
    holder.updateMatrixWorld(true);

    if (screen) {
      screen.geometry = screen.geometry.clone();
      remapScreenUVs(T, screen);
      screen.material = new T.MeshBasicMaterial({ map: this.face.texture, toneMapped: false });
      screen.geometry.computeBoundingBox();
      this.screen = screen;
      this.screenCenter = screen.geometry.boundingBox.getCenter(new T.Vector3());
    }

    // Jet points: the back face of the left and right thruster vertex clusters
    const clusters = [[], []];
    const v = new T.Vector3();
    meshes.filter((m) => /thruster|cylinder.?0(08|09|10|11)/i.test(name(m))).forEach((m) => {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        clusters[v.x < 0 ? 0 : 1].push(v.clone());
      }
    });
    clusters.forEach((points) => {
      if (!points.length) return;
      const minZ = points.reduce((m, p) => Math.min(m, p.z), Infinity);
      const near = points.filter((p) => p.z < minZ + 0.06 * MODEL_HEIGHT);
      const cx = near.reduce((a, p) => a + p.x, 0) / near.length;
      const cy = near.reduce((a, p) => a + p.y, 0) / near.length;
      const jet = new T.Object3D();
      holder.add(jet);
      jet.position.copy(holder.worldToLocal(new T.Vector3(cx, cy, minZ)));
      this.jets.push(jet);
    });

    // Antennas wobble from their base, cables swing from their top
    const wobble = (pattern, top) => meshes.filter((m) => pattern.test(name(m))).forEach((m) => {
      const bb = new T.Box3().setFromObject(m);
      const bc = bb.getCenter(new T.Vector3());
      const group = new T.Group();
      group.position.copy(holder.worldToLocal(new T.Vector3(bc.x, top ? bb.min.y : bb.max.y, bc.z)));
      holder.add(group);
      group.updateMatrixWorld(true);
      group.attach(m);
      this.wobblers.push({ group, top, phase: Math.random() * 6, rest: group.quaternion.clone() });
    });
    wobble(/antennatop|cylinder.?01(2|3)/i, true);
    wobble(/cable|bezier|antenna(a|b)\b/i, false);
  }

  applyTheme() {
    const accent = cssColor('--accent');
    const primary = cssColor('--primary');
    if (accent) this.rim.color.setStyle(accent);
    if (primary) this.rim2.color.setStyle(primary);
  }

  /** Where the face screen is on the page, for the speech bubble (canvas = `box` px centered at cx, cy). */
  headOnPage(cx, cy, box) {
    if (!this.screen) return { x: cx, y: cy - box * 0.12 };
    const p = this.screen.localToWorld(this.tmp.copy(this.screenCenter)).project(this.camera);
    return { x: cx + (p.x * box) / 2, y: cy - (p.y * box) / 2 };
  }

  /**
   * Pose and draw one frame. t and dt are in ms. p: lookX/lookY (-1..1), vx/vy (px per frame),
   * expr, talk, nod, hop, spin (0..1, -1 none), sleepy, boost, towing, scale (pop in/out), still.
   */
  frame(t, dt, p) {
    const k = dt / 16;
    const st = this.st;
    const s = p.still ? 0 : 1;

    let ty = p.sleepy ? 0 : p.lookX * 0.55;
    let tp = p.sleepy ? 0.35 : p.lookY * 0.25;
    const tr = clamp(-p.vx * 0.03, -0.35, 0.35);
    if (p.towing) ty = -0.6;
    if (p.nod) tp += Math.sin(t / 110) * 0.22 * s;
    st.y += (ty - st.y) * Math.min(1, 0.1 * k);
    st.p += (tp - st.p) * Math.min(1, 0.1 * k);
    st.r += (tr - st.r) * Math.min(1, 0.1 * k);

    const spin = p.spin >= 0 ? easeInOut(p.spin) * Math.PI * 2 : 0;
    const hop = p.hop >= 0 ? Math.sin(p.hop * Math.PI) * 0.45 : 0;
    this.pivot.scale.setScalar(Math.max(0.001, p.scale));
    this.pivot.position.y = s * (Math.sin(t / (p.sleepy ? 1100 : 650)) * 0.12 + hop) - (p.sleepy ? 0.2 : 0);
    this.pivot.rotation.set(st.p, st.y + spin, st.r + s * Math.sin(t / 1100) * 0.03);

    // Cables and antennas react to movement
    const vy = p.vy * 0.01 + this.pivot.position.y - st.prevY;
    const vyaw = st.y + spin - st.prevYaw;
    st.prevY = this.pivot.position.y;
    st.prevYaw = st.y + spin;
    st.swV += (-st.sw * 0.08 - vy * 3 - vyaw * 2 - p.vx * 0.004) * k;
    st.swV *= 0.9;
    st.sw += st.swV * 0.12 * k;
    this.wobblers.forEach((w) => {
      const a = w.top ? s * Math.sin(t / 430 + w.phase) * 0.1 + st.sw * 0.35 : s * Math.sin(t / 700 + w.phase) * 0.12 + st.sw * 0.6;
      this.eu.set(w.top ? st.sw * 0.2 : a * 0.6, 0, w.top ? a : a * 0.5 + (p.sleepy ? 0.15 : 0));
      this.q.setFromEuler(this.eu);
      w.group.quaternion.copy(w.rest).multiply(this.q);
    });

    // Face: blinks, an ear flick now and then, gaze from lookX/lookY
    if (t > st.blinkAt) st.blinkAt = t + 2200 + Math.random() * 2600;
    const bt = st.blinkAt - t;
    const blink = p.still ? 0 : bt < 170 ? (bt > 120 || bt < 40 ? 1 : 2) : 0;
    if (t > st.twitchAt) {
      st.twitchAt = t + 3500 + Math.random() * 4500;
      st.twitchSide = Math.random() < 0.5 ? 1 : 2;
    }
    const twitch = !p.still && !p.sleepy && st.twitchAt - t > 3500 - 180 ? st.twitchSide : 0;
    this.face.draw({
      expr: p.expr,
      dx: Math.round(p.lookX * 2),
      dy: Math.round(p.lookY * 1.5),
      blink,
      talk: p.talk,
      twitch,
    });

    // Flames: oriented along the jets' backward direction as seen by the camera
    this.pivot.updateMatrixWorld(true);
    this.camera.getWorldDirection(this.camDir);
    this.dirW.set(0, -0.25, -1).normalize().applyQuaternion(this.pivot.quaternion);
    const speed = Math.hypot(p.vx, p.vy);
    this.flames.forEach((f, i) => {
      const jet = this.jets[i];
      const visible = !!jet && p.scale > 0.05;
      f.glow.visible = f.flame.visible = f.core.visible = visible;
      if (!visible) return;
      jet.getWorldPosition(this.tmp);
      const a = this.tmp.clone().project(this.camera);
      const b = this.tmp.clone().add(this.dirW).project(this.camera);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const fore = Math.sqrt(Math.max(0.1, 1 - Math.pow(this.dirW.dot(this.camDir), 2)));
      const flicker = (p.sleepy ? 0.4 : p.boost * (1 + Math.min(0.5, speed * 0.04))) * (p.still ? 1 : 0.82 + Math.random() * 0.3);
      const w = 0.18 * p.scale;
      f.glow.position.copy(this.tmp);
      f.flame.position.copy(this.tmp);
      f.core.position.copy(this.tmp);
      f.flame.material.rotation = angle + Math.PI / 2;
      f.flame.scale.set(w, w * 4 * fore * flicker, 1);
      f.glow.scale.setScalar(w * 2 * (p.sleepy ? 0.6 : 1));
      f.core.scale.setScalar(w * 0.7);
    });

    this.renderer.render(this.scene, this.camera);
  }
}

/* ------------------------------------------------------------------------------------------------
 * Max: placement, flight, speech, expressions, and reactions
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
    this.R = this.compact ? 150 : 300;
    this.layer.classList.toggle('is-compact', this.compact);
    this.body.style.width = this.body.style.height = `${this.R}px`;
    this.engine = new Engine(THREE, gltf, this.canvas, this.R);
    this.engine.applyTheme();

    const now = performance.now();
    this.s = {
      cx: -this.R, cy: window.innerHeight * 0.4, vx: 0, vy: 0, scale: 0.6, pop: 0,
      expr: 'idle', exprUntil: 0, spinFrom: -1e9, hopFrom: -1e9, nodUntil: 0,
      cursor: null, cursorMovedAt: -1e9, lastInput: now, sleeping: false, sleptAt: 0,
      pokes: 0, pokeAt: 0,
    };
    this.target = null;
    this.mode = 'hero';
    this.presenting = null;       // { section, until, said } while introducing a heading
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
    this.target = this.computeTarget(performance.now());
    // Pop in where he is needed, rising slightly (in place for reduced motion)
    const s = this.s;
    s.cx = this.target.cx;
    s.cy = this.target.cy + (reducedMotion ? 0 : 40);
    s.scale = this.target.scale;
    s.vx = s.vy = 0;
    s.pop = reducedMotion ? 1 : 0;
    this.start();
    if (greet) {
      // Heart eyes the moment he appears on the opening screen
      this.setExpr('love', 4200);
      setTimeout(() => this.greet(), reducedMotion ? 200 : 700);
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
      this.R = compact ? 150 : 300;
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
      const scale = 0.72;
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
      const scale = 0.7;
      if (nr && nr.width > 0) {
        return { mode: 'dock', scale, cx: nr.left + nr.width * 0.47, cy: nr.top + nr.height * 0.5, section: this.visibleSection(), free: true };
      }
      return { mode: 'dock', scale, cx: 90, cy: vh - 50, section: this.visibleSection() };
    }

    // A section heading just scrolled into view: fly over and introduce it
    const heading = this.presentableEyebrow(R * 0.62, vh);
    if (!this.presenting && heading && LINES.sections[heading.section] && !this.introduced.has(heading.section) && !s.sleeping) {
      this.presenting = { section: heading.section, until: now + PRESENT_MS, said: false };
    }
    if (this.presenting) {
      if (now > this.presenting.until || !heading || heading.section !== this.presenting.section) {
        this.introduced.add(this.presenting.section);
        this.presenting = null;
      } else {
        const scale = 0.62;
        const box = R * scale;
        return { mode: 'present', scale, cx: heading.rect.right + box * 0.34 + 10, cy: heading.rect.top + heading.rect.height / 2 - box * 0.06, section: heading.section, lookAt: heading.rect };
      }
    }

    // Follow the cursor while it is moving (and hold still while it is on Max, so he can be patted).
    // Not while it is up in the navbar: he would only hover over the headings below it.
    const cursorInPage = s.cursor && s.cursor.y > NAV_CLEARANCE;
    if (cursorInPage && !s.sleeping && (this.petting || now - s.cursorMovedAt < FOLLOW_IDLE)) {
      const scale = 0.72;
      if (this.petting) return { mode: 'follow', scale, cx: s.cx, cy: s.cy };
      const box = R * scale;
      const gap = box * 0.28 + 30;
      const side = s.cursor.x + gap + box * 0.3 < vw - 8 ? 1 : -1;
      return { mode: 'follow', scale, cx: s.cursor.x + side * gap, cy: s.cursor.y - box * 0.04 };
    }

    // Hero, cursor at rest: hover above the terminal (or in the open space on the right)
    const hero = document.getElementById('top');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    if (heroRect && heroRect.bottom > vh * 0.55) {
      const terminal = document.querySelector('.hero-terminal');
      const tr = terminal ? terminal.getBoundingClientRect() : null;
      if (tr && tr.width > 0) {
        const scale = 0.9;
        return { mode: 'hero', scale, cx: tr.left + tr.width * 0.2, cy: tr.top - R * scale * 0.3 };
      }
      return { mode: 'hero', scale: 0.95, cx: vw - Math.max(180, vw * 0.18), cy: vh * 0.45 + heroRect.top * 0.6 };
    }

    // Napping: settle in the bottom-left corner beside the robot button
    if (s.sleeping) {
      const scale = 0.5;
      return { mode: 'dock', scale, cx: 64 + R * scale * 0.3, cy: vh - 24 - R * scale * 0.32 };
    }

    // Reading: perch at the nearest screen edge, at the height he was
    const scale = 0.55;
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
    const ty = tg.free ? tg.cy : clamp(tg.cy, NAV_CLEARANCE + box * 0.3, vh - box * 0.32);
    if (reducedMotion) {
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
    if (this.curtain === 'tow') {
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
      hop: hopP <= 1 ? hopP : -1,
      spin: spinP <= 1 ? spinP : -1,
      sleepy: s.sleeping,
      boost: this.curtain === 'tow' ? 1.6 : 1,
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
