/**
 * Max: the flying mech-wolf guide for Kritagya Yadav's portfolio.
 *
 * - Lazy-loads three.js (mapped by the import map in index.html) and his model after the page
 *   intro finishes, and only when the browser supports WebGL.
 * - Model: "Wolf" by Quaternius, CC0 1.0 (public domain); trimmed to the clips used here and
 *   meshopt-compressed. Turned into a machine at runtime: chrome armour, glowing circuit lines
 *   (a wireframe skinned to the same skeleton), emerald eyes, a thruster jetpack, and an antenna.
 * - Flies alongside the cursor while it moves and turns his head to look at it; flies to each
 *   section heading as it scrolls into view to introduce it; hovers by the hero terminal; leads the
 *   section-transition curtain; naps in the corner when you go idle.
 * - On touch screens and narrow windows he hovers in the empty middle of the navbar instead.
 * - The paw button in the bottom-left corner hides or shows Max; the choice is remembered.
 * - Honours prefers-reduced-motion: Max holds still, does not chase the cursor, and does not type letter by letter.
 */

const MODEL_URL = 'assets/models/max-wolf.glb';
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
const EMERALD = '#34d399';
const PURPLE = '#a855f7';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const damp = (current, target, lambda, dt) => target + (current - target) * Math.exp(-lambda * dt);

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
      'B.Tech CSE, class of 2027. Backend is his thing.',
    ],
    skills: [
      'His toolbox: 46 skills across 8 categories.',
      'Spring Boot, PostgreSQL, Redis, Docker... the usual suspects.',
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
    theme: () => (root.getAttribute('data-theme') === 'light' ? ['Back to night mode? Wolf hours.'] : ['Light mode? My night vision objects.']),
    palette: ['Psst: Ctrl+K works from anywhere.'],
    hire: ['Good call.', 'That button leads straight to his inbox.'],
    github: ['Where the source code lives.'],
    linkedin: ['The professional side of things.'],
    leetcode: ['Where the algorithms get practised.'],
    eventBooking: ['83 endpoints. @Version stops two people grabbing the same seat.'],
    linkpulse: ["This one's live on Render. The demo works."],
    keyvault: ['Small service, clean layers.'],
    code: ['That @Version line? It is the whole trick.'],
    terminal: ['Nice landing pad, this terminal.'],
    languages: ['Bytes of code, not opinions. Java leads the pack.'],
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
    all: 'All three projects, back with the pack.',
    concurrency: "High concurrency: that's the Event Booking System.",
    devops: 'Cloud & DevOps: LinkPulse ships itself to Render.',
    security: 'Security & APIs: Event Booking and KeyVault.',
  },
  copied: ['Fetched! His email is on your clipboard.'],
  themeLight: ['Too bright! Wolves are night people.'],
  themeDark: ['Ahh, night mode. Much better.'],
  poke: [
    'Beep-awoo! That tickles.',
    'Tip: press Ctrl+K to jump anywhere.',
    'Tip: press ? for keyboard shortcuts.',
    'Lone wolf? Nah. Team player.',
    'Running on Java and jet fuel.',
  ],
  dizzy: ['Okay, okay! Engines overheating.'],
  idle: ['Still there? The projects are worth a sniff.', 'Psst: the Contact section has a copy-email button.'],
  wake: ['Rebooting... I was just resting my eyes.'],
  hide: ['Powering down. The paw button wakes me up.'],
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
  ['[data-project-card="event-booking"]', 'eventBooking'],
  ['[data-project-card="linkpulse"]', 'linkpulse'],
  ['[data-project-card="keyvault"]', 'keyvault'],
  ['.code-card', 'code'],
  ['.hero-terminal', 'terminal'],
  ['#lang-card', 'languages'],
];

/* ------------------------------------------------------------------------------------------------
 * Engine: three.js scene around the rigged wolf, rebuilt as a flying machine
 * ---------------------------------------------------------------------------------------------- */

const ONE_SHOTS = ['Idle_2', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Jump_ToIdle', 'Gallop_Jump'];

function gradientTexture(T, stops, { width = 16, height = 128, radial = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = radial ? 64 : width;
  canvas.height = radial ? 64 : height;
  const ctx = canvas.getContext('2d');
  const g = radial
    ? ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    : ctx.createLinearGradient(0, canvas.height, 0, 0); // bottom of the canvas = v 0
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

class Engine {
  constructor(THREE, RoomEnvironment, gltf, canvas, size) {
    this.T = THREE;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.setSize(size);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0.9, 10);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 5, 6);
    this.rim = new THREE.DirectionalLight(EMERALD, 2.2);
    this.rim.position.set(-4, 2, -5);
    this.backRim = new THREE.DirectionalLight(PURPLE, 1.6);
    this.backRim.position.set(4, 1, -4);
    this.scene.add(key, this.rim, this.backRim);

    this.turn = new THREE.Group(); // facing (y), tilt (z), bob (position.y)
    this.scene.add(this.turn);
    this.mount(gltf);
    this.lookCorrection = new THREE.Quaternion();
  }

  setSize(size) {
    this.renderer.setSize(size, size, false);
  }

  /** Point the nose at +Z, centre and scale the wolf, then armour him up and set up animations. */
  mount(gltf) {
    const T = this.T;
    const model = gltf.scene;
    const orient = new T.Group();
    orient.add(model);
    const holder = new T.Group();
    holder.add(orient);
    this.turn.add(holder);

    model.updateMatrixWorld(true);
    const rawBox = new T.Box3().setFromObject(model);
    this.head = model.getObjectByName('Head');
    if (this.head) {
      const nose = this.head.getWorldPosition(new T.Vector3()).sub(rawBox.getCenter(new T.Vector3()));
      orient.rotation.y = -Math.atan2(nose.x, nose.z);
    }
    orient.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(orient);
    const size = box.getSize(new T.Vector3());
    const scale = 3.3 / Math.max(size.z, size.x, size.y * 1.4);
    holder.scale.setScalar(scale);
    holder.position.copy(box.getCenter(new T.Vector3())).multiplyScalar(-scale);
    this.turn.updateMatrixWorld(true);
    this.height = size.y * scale;
    this.length = Math.max(size.z, size.x) * scale;

    this.armour(model);
    this.buildJetpack(model);
    this.buildAntenna();

    // Anti-gravity glow under the belly
    this.glow = new T.Sprite(new T.SpriteMaterial({
      map: gradientTexture(T, [[0, 'rgba(52, 211, 153, 0.85)'], [0.45, 'rgba(52, 211, 153, 0.25)'], [1, 'rgba(52, 211, 153, 0)']], { radial: true }),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
    }));
    this.glow.position.set(0, -this.height * 0.62, 0);
    this.glow.scale.set(this.length * 0.7, this.length * 0.22, 1);
    this.turn.add(this.glow);

    // The head looks along +Z at rest; remember that axis in the head's own frame for gaze tracking
    if (this.head) {
      const headQuat = this.head.getWorldQuaternion(new T.Quaternion());
      this.headForward = new T.Vector3(0, 0, 1).applyQuaternion(headQuat.invert());
    }

    // Animations: one looping base clip plus short one-shots on top
    this.mixer = new T.AnimationMixer(model);
    this.actions = {};
    gltf.animations.forEach((clip) => { this.actions[clip.name] = this.mixer.clipAction(clip); });
    ONE_SHOTS.forEach((name) => {
      const action = this.actions[name];
      if (!action) return;
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
    });
    // "Glide": a held mid-leap frame (legs stretched out) for fast flight
    const leap = gltf.animations.find((clip) => clip.name === 'Gallop_Jump');
    if (leap) {
      const glideClip = leap.clone();
      glideClip.name = 'Glide';
      const glide = this.mixer.clipAction(glideClip);
      glide.time = leap.duration * 0.42;
      glide.setEffectiveTimeScale(0);
      this.actions.Glide = glide;
    }
    this.base = null;
    this.baseAction = null;
    this.oneShot = null;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.oneShot) return;
      this.oneShot.fadeOut(0.3);
      this.oneShot = null;
      if (this.baseAction) this.startBase(this.baseAction, 0.3);
    });
    this.setBase('Idle');
  }

  /** (Re)start a looping base action; the Glide pose is a held frame, so pin its time. */
  startBase(action, fade) {
    action.reset();
    if (action.getClip().name === 'Glide') action.time = action.getClip().duration * 0.42;
    action.setEffectiveWeight(1).fadeIn(fade).play();
  }

  /** Swap the fur for metal and lay a glowing wireframe (skinned to the same bones) over it. */
  armour(model) {
    const T = this.T;
    this.armourMat = new T.MeshStandardMaterial({
      color: '#334155', metalness: 0.85, roughness: 0.32, flatShading: true,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    this.plateMat = new T.MeshStandardMaterial({
      color: '#cbd5e1', metalness: 0.9, roughness: 0.22, flatShading: true,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    this.eyeMat = new T.MeshStandardMaterial({ color: EMERALD, emissive: EMERALD, emissiveIntensity: 2.6, toneMapped: false });
    this.noseMat = new T.MeshStandardMaterial({ color: '#0b1220', metalness: 0.6, roughness: 0.4 });
    this.wireMat = new T.MeshBasicMaterial({
      color: EMERALD, wireframe: true, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false,
    });
    const swaps = { Main: this.armourMat, Main_Light: this.plateMat, Eyes_Black: this.eyeMat, Nose: this.noseMat };
    const meshes = [];
    model.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
    meshes.forEach((mesh) => {
      mesh.frustumCulled = false; // skinned + animated: the bind-pose bounds are not reliable
      const swap = swaps[mesh.material && mesh.material.name];
      if (swap) mesh.material = swap;
      if (mesh.isSkinnedMesh && (swap === this.armourMat || swap === this.plateMat)) {
        const wire = new T.SkinnedMesh(mesh.geometry, this.wireMat);
        wire.bind(mesh.skeleton, mesh.bindMatrix);
        wire.position.copy(mesh.position);
        wire.quaternion.copy(mesh.quaternion);
        wire.scale.copy(mesh.scale);
        wire.frustumCulled = false;
        mesh.parent.add(wire);
      }
    });
  }

  /** Attach an object (built in model-space units, upright) so it rides on a bone, offset from it. */
  attach(bone, object, offset) {
    const T = this.T;
    const position = bone.getWorldPosition(new T.Vector3()).add(offset);
    const worldScale = bone.getWorldScale(new T.Vector3());
    bone.add(object);
    object.position.copy(bone.worldToLocal(position));
    object.quaternion.copy(bone.getWorldQuaternion(new T.Quaternion()).invert());
    object.scale.setScalar(1 / worldScale.x);
  }

  buildJetpack(model) {
    const T = this.T;
    const torso = model.getObjectByName('Torso2') || model.getObjectByName('Torso');
    if (!torso) return;
    const metal = new T.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.25 });
    this.trimMat = new T.MeshStandardMaterial({ color: EMERALD, emissive: EMERALD, emissiveIntensity: 2, toneMapped: false });
    const flameTex = gradientTexture(T, [
      [0, 'rgba(240, 253, 250, 1)'], [0.2, 'rgba(110, 231, 183, 0.95)'], [0.6, 'rgba(168, 85, 247, 0.45)'], [1, 'rgba(168, 85, 247, 0)'],
    ]);
    const flameMat = new T.MeshBasicMaterial({
      map: flameTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
    });

    const pack = new T.Group();
    const L = this.length;
    const body = new T.Mesh(new T.BoxGeometry(L * 0.17, L * 0.06, L * 0.22), metal);
    pack.add(body);
    const stripe = new T.Mesh(new T.BoxGeometry(L * 0.172, L * 0.012, L * 0.12), this.trimMat);
    stripe.position.y = L * 0.031;
    pack.add(stripe);

    this.flames = [];
    [-1, 1].forEach((side) => {
      const pod = new T.Group();
      pod.position.set(side * L * 0.11, -L * 0.005, -L * 0.03);
      pod.rotation.x = -0.35; // nozzles aim back and slightly down
      const tube = new T.Mesh(new T.CylinderGeometry(L * 0.04, L * 0.034, L * 0.2, 14), metal);
      tube.rotation.x = Math.PI / 2;
      pod.add(tube);
      const ring = new T.Mesh(new T.TorusGeometry(L * 0.041, L * 0.008, 8, 20), this.trimMat);
      ring.position.z = L * 0.05;
      pod.add(ring);
      const flame = new T.Mesh(new T.ConeGeometry(L * 0.032, L * 0.24, 14, 1, true), flameMat);
      flame.rotation.x = -Math.PI / 2; // tip points backwards (-Z)
      flame.userData = { nozzleZ: -L * 0.1, halfLength: L * 0.12 };
      flame.position.z = -L * 0.22;
      pod.add(flame);
      this.flames.push(flame);
      // Little fin on the outside of each thruster
      const fin = new T.Mesh(new T.BoxGeometry(L * 0.1, L * 0.008, L * 0.07), metal);
      fin.position.set(side * L * 0.06, L * 0.012, -L * 0.02);
      fin.rotation.z = side * -0.4;
      pod.add(fin);
      pack.add(pod);
    });
    this.attach(torso, pack, new T.Vector3(0, this.height * 0.2, 0));
  }

  buildAntenna() {
    const T = this.T;
    if (!this.head) return;
    const L = this.length;
    const antenna = new T.Group();
    const stalk = new T.Mesh(
      new T.CylinderGeometry(L * 0.006, L * 0.008, L * 0.12, 8),
      new T.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.3 })
    );
    stalk.position.y = L * 0.06;
    antenna.add(stalk);
    this.antennaTip = new T.Mesh(
      new T.SphereGeometry(L * 0.018, 16, 12),
      new T.MeshStandardMaterial({ color: PURPLE, emissive: PURPLE, emissiveIntensity: 2.4, toneMapped: false })
    );
    this.antennaTip.position.y = L * 0.125;
    antenna.add(this.antennaTip);
    antenna.rotation.z = -0.25;
    this.attach(this.head, antenna, new T.Vector3(0, this.height * 0.12, -this.length * 0.02));
  }

  setBase(name, timeScale = 1) {
    const action = this.actions[name];
    if (!action) return;
    if (name !== 'Glide') action.setEffectiveTimeScale(timeScale);
    if (name === this.base) return;
    const previous = this.baseAction;
    this.base = name;
    this.baseAction = action;
    if (this.oneShot) return; // the new base fades in when the one-shot finishes
    this.startBase(action, 0.3);
    if (previous) previous.fadeOut(0.3);
  }

  playOnce(name) {
    const action = this.actions[name];
    if (!action || reducedMotion) return;
    if (this.oneShot) this.oneShot.fadeOut(0.15);
    else if (this.baseAction) this.baseAction.fadeOut(0.15);
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.15).play();
    this.oneShot = action;
  }

  applyTheme() {
    const light = root.getAttribute('data-theme') === 'light';
    this.wireMat.color.setStyle(light ? '#059669' : EMERALD);
    this.wireMat.opacity = light ? 0.22 : 0.12;
    this.armourMat.color.setStyle(light ? '#475569' : '#334155');
  }

  /**
   * Screen-space helpers: the canvas is a box of `box` px centred at (cx, cy) on the page.
   * pageToWorld() casts the page point onto a plane just in front of Max.
   */
  pageToWorld(x, y, cx, cy, box) {
    const T = this.T;
    const ndc = new T.Vector3((x - cx) / (box / 2), -(y - cy) / (box / 2), 0.5).unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    const t = (2.2 - this.camera.position.z) / dir.z; // plane z = 2.2
    return this.camera.position.clone().add(dir.multiplyScalar(t));
  }

  headOnPage(cx, cy, box) {
    if (!this.head) return { x: cx, y: cy - box * 0.15 };
    const p = this.head.getWorldPosition(new this.T.Vector3()).project(this.camera);
    return { x: cx + (p.x * box) / 2, y: cy - (p.y * box) / 2 };
  }

  /** Advance animations and pose. `st` comes from the controller. */
  update(dt, t, st) {
    const T = this.T;
    this.mixer.update(reducedMotion ? 0 : dt);
    const bob = st.still ? 0 : Math.sin(t * 2.3) * 0.09;
    this.turn.position.y = bob;
    this.turn.rotation.y = damp(this.turn.rotation.y, st.facing, 6, dt);
    this.turn.rotation.z = damp(this.turn.rotation.z, st.tilt, 5, dt);
    this.turn.rotation.x = damp(this.turn.rotation.x, st.pitch, 5, dt);
    this.turn.updateMatrixWorld(true);

    // Head tracking: turn the head bone towards the look target (on top of the animation)
    if (this.head && this.headForward) {
      let correction = new T.Quaternion();
      if (st.lookTarget) {
        const headPos = this.head.getWorldPosition(new T.Vector3());
        const headQuat = this.head.getWorldQuaternion(new T.Quaternion());
        const forward = this.headForward.clone().applyQuaternion(headQuat).normalize();
        const wanted = st.lookTarget.clone().sub(headPos).normalize();
        correction.setFromUnitVectors(forward, wanted);
        const angle = 2 * Math.acos(clamp(correction.w, -1, 1));
        const maxAngle = 0.75;
        if (angle > maxAngle) correction = new T.Quaternion().slerp(correction, maxAngle / angle);
      }
      this.lookCorrection.slerp(correction, 1 - Math.exp(-8 * dt));
      const parentQuat = this.head.parent.getWorldQuaternion(new T.Quaternion());
      const headWorld = this.head.getWorldQuaternion(new T.Quaternion());
      const corrected = this.lookCorrection.clone().multiply(headWorld);
      this.head.quaternion.copy(parentQuat.invert().multiply(corrected));
      this.head.updateMatrixWorld(true);
    }

    // Thrusters, glow and antenna pulse with speed
    const thrust = (st.sleeping ? 0.45 : 0.85) + st.speed * 0.9 + (st.still ? 0 : Math.sin(t * 34) * 0.08);
    (this.flames || []).forEach((flame) => {
      // Stretch the flame while keeping its base on the nozzle
      flame.scale.set(1, thrust, 1);
      flame.position.z = flame.userData.nozzleZ - flame.userData.halfLength * thrust;
    });
    this.glow.material.opacity = st.sleeping ? 0.35 : 0.65 + Math.sin(t * 3) * 0.2;
    if (this.antennaTip) this.antennaTip.material.emissiveIntensity = st.sleeping ? 0.6 : 2 + Math.sin(t * 4) * 0.8;
    this.eyeMat.emissiveIntensity = st.sleeping ? 0.5 : 2.6;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

/* ------------------------------------------------------------------------------------------------
 * Max: placement, flight, speech, and reactions
 * ---------------------------------------------------------------------------------------------- */

class Max {
  constructor(THREE, RoomEnvironment, gltf) {
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
    this.engine = new Engine(THREE, RoomEnvironment, gltf, this.canvas, this.R);
    this.engine.applyTheme();

    const now = performance.now();
    this.s = {
      cx: -this.R, cy: window.innerHeight * 0.4, vx: 0, vy: 0, scale: 0.6, dir: 1,
      cursor: null, cursorMovedAt: -1e9, lastInput: now, sleeping: false, sleptAt: 0,
      pokes: 0, pokeAt: 0, nextFidget: now + 9000,
    };
    this.T = THREE;
    this.target = null;
    this.mode = 'hero';
    this.presenting = null;       // { section, until, said } while introducing a heading
    this.curtain = null;          // 'tow' while flying the section curtain in, 'hold' while it covers the page
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
    this.t = 0;
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
    // Fly in from the left edge (or appear in place for reduced motion / on small screens)
    this.s.cx = reducedMotion || this.compact ? this.target.cx : -this.R * 0.3;
    this.s.cy = this.target.cy;
    this.s.scale = this.target.scale;
    this.s.vx = this.s.vy = 0;
    this.start();
    if (greet) {
      setTimeout(() => this.greet(), reducedMotion ? 200 : 1400);
    } else {
      this.say(pick(LINES.show, 'show'), { prio: 3 });
    }
  }

  hide() {
    this.say(pick(LINES.hide, 'hide'), { prio: 3 });
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
    this.engine.playOnce('Idle_2');
    this.say(greeting, { prio: 2 });
    const followDelay = (reducedMotion ? 0 : greeting.length * 24) + 2600;
    setTimeout(() => {
      if (this.compact) this.say(LINES.greetFollow[1], { prio: 2 });
      else if (this.mode === 'hero' || this.mode === 'follow') this.say(pick(LINES.greetFollow, 'greetFollow'), { prio: 2 });
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
          this.engine.playOnce('Jump_ToIdle');
          this.say(pick(LINES.wake, 'wake'), { prio: 2 });
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

    // Pat Max: he holds still while the pointer is on him
    this.hit.addEventListener('pointerenter', () => { this.petting = true; });
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
        if (this.say(pick(source, `hover-${match.key}`), { prio: 1 })) this.hoverCooldowns.set(match.key, performance.now());
      }, HOVER_DWELL);
    });
    document.addEventListener('pointerout', (e) => {
      if (!hoverEl || (e.relatedTarget && hoverEl.contains(e.relatedTarget))) return;
      hoverEl = null;
      clearTimeout(hoverTimer);
    });

    // Section transitions: fly the curtain in, wait while it covers the page, then carry on
    document.addEventListener('ky:curtain', (e) => {
      if (this.hidden || this.compact) return;
      const { phase, label, id } = e.detail;
      if (phase === 'start') {
        this.curtain = 'tow';
        this.presenting = null;
        this.s.sleeping = false;
        this.say(pick(LINES.curtain(label), 'curtain'), { prio: 3 });
      } else if (phase === 'covered') {
        this.curtain = 'hold';
        this.engine.playOnce('Idle_2');
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
      this.engine.playOnce('Idle_2');
      this.say(LINES.filters[e.detail.filter] || `Showing ${e.detail.label}.`, { prio: 2 });
    });
    document.addEventListener('ky:skill', (e) => {
      const now = performance.now();
      if (now - this.lastSkillAt < SKILL_COOLDOWN) return;
      const line = LINES.skills[e.detail.id];
      if (line && this.say(line, { prio: 2 })) this.lastSkillAt = now;
    });
    document.addEventListener('ky:copy-email', () => {
      this.engine.playOnce('Jump_ToIdle');
      this.say(pick(LINES.copied, 'copied'), { prio: 2 });
    });
    document.addEventListener('ky:themechange', (e) => {
      this.engine.applyTheme();
      this.engine.playOnce('Idle_2');
      const light = e.detail && e.detail.theme === 'light';
      this.say(pick(light ? LINES.themeLight : LINES.themeDark, 'theme'), { prio: 2 });
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
    if (s.pokes >= 4) {
      s.pokes = 0;
      this.engine.playOnce('Gallop_Jump');
      this.say(pick(LINES.dizzy, 'dizzy'), { prio: 2 });
    } else {
      this.engine.playOnce(s.pokes % 2 ? 'Idle_HitReact_Left' : 'Idle_HitReact_Right');
      this.say(pick(LINES.poke, 'poke'), { prio: 2 });
    }
  }

  /* ---- speech ---- */

  /**
   * Show a speech bubble. prio 1 = unprompted (sections, hovers, idle), 2 = reactions, 3 = show/hide/curtain.
   * Returns false when the line was skipped (cooldown, a more important line is playing, or hidden).
   */
  say(text, { prio = 1 } = {}) {
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
    this.speaking = true;
    this.speakingPrio = prio;
    const hold = clamp(text.length * 55, 2600, 6500);

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
   * corner, or simply hovering where he is.
   */
  computeTarget(now) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const R = this.R;
    const s = this.s;

    if (this.curtain) {
      const scale = 0.72;
      const box = R * scale;
      const rest = box * 0.42 + 12;
      if (this.curtain === 'tow') {
        const curtainEl = document.getElementById('section-curtain');
        const left = curtainEl ? curtainEl.getBoundingClientRect().left : 0;
        return { mode: 'tow', scale, cx: Math.max(rest, left - box * 0.1), cy: vh * 0.55, snap: true };
      }
      return { mode: 'hold', scale, cx: rest, cy: vh * 0.55 };
    }

    if (this.compact) {
      // Phones / small windows: hover in the empty middle of the navbar so content stays clear
      const nav = document.getElementById('nav-inner');
      const nr = nav ? nav.getBoundingClientRect() : null;
      const scale = 0.62;
      if (nr && nr.width > 0) {
        return { mode: 'dock', scale, cx: nr.left + nr.width * 0.45, cy: nr.top + nr.height * 0.5, section: this.visibleSection(), free: true };
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
        return { mode: 'present', scale, cx: heading.rect.right + box * 0.38, cy: heading.rect.top - box * 0.02, section: heading.section };
      }
    }

    // Follow the cursor while it is moving (and hold still while it is on Max, so he can be patted)
    if (s.cursor && !s.sleeping && (this.petting || now - s.cursorMovedAt < FOLLOW_IDLE)) {
      const scale = 0.72;
      if (this.petting) return { mode: 'follow', scale, cx: s.cx, cy: s.cy };
      const box = R * scale;
      const gap = box * 0.36 + 34;
      const side = s.cursor.x + gap + box * 0.3 < vw - 8 ? 1 : -1;
      return { mode: 'follow', scale, cx: s.cursor.x + side * gap, cy: s.cursor.y - box * 0.1 };
    }

    // Hero, cursor at rest: hover beside the terminal (or in the open space on the right)
    const hero = document.getElementById('top');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    if (heroRect && heroRect.bottom > vh * 0.55) {
      const terminal = document.querySelector('.hero-terminal');
      const tr = terminal ? terminal.getBoundingClientRect() : null;
      if (tr && tr.width > 0) {
        return { mode: 'hero', scale: 0.9, cx: tr.left + tr.width * 0.12, cy: tr.top - R * 0.9 * 0.12 };
      }
      return { mode: 'hero', scale: 0.95, cx: vw - Math.max(180, vw * 0.18), cy: vh * 0.45 + heroRect.top * 0.6 };
    }

    // Napping: settle in the bottom-left corner beside the paw button
    if (s.sleeping) {
      const scale = 0.5;
      return { mode: 'dock', scale, cx: 64 + R * scale * 0.34, cy: vh - 24 - R * scale * 0.3 };
    }

    // Otherwise keep hovering where he is
    return { mode: 'rest', scale: Math.max(0.55, Math.min(s.scale, 0.7)), cx: s.cx, cy: s.cy };
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
      if (rect.top < NAV_CLEARANCE + box * 0.4 || rect.top > vh * 0.82) return;
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
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.frame += 1;
    const s = this.s;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const engine = this.engine;

    if (!this.target || this.curtain || this.frame % 2 === 0) this.target = this.computeTarget(now);
    const tg = this.target;
    this.mode = tg.mode;

    // Fly: ride the curtain edge exactly, otherwise a soft spring (looser while following the cursor)
    const box = this.R * s.scale;
    const tx = tg.snap || tg.free ? tg.cx : clamp(tg.cx, box * 0.32 + 8, vw - box * 0.32 - 8);
    const ty = tg.free ? tg.cy : clamp(tg.cy, NAV_CLEARANCE + box * 0.3, vh - box * 0.36);
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
    const R = this.R;
    this.body.style.transform = `translate3d(${(s.cx - R / 2).toFixed(1)}px, ${(s.cy - R / 2).toFixed(1)}px, 0) scale(${s.scale.toFixed(3)})`;

    // Introduce the section once he has arrived at its heading
    if (this.presenting && !this.presenting.said && tg.mode === 'present' && Math.hypot(tx - s.cx, ty - s.cy) < 60) {
      if (this.say(pick(LINES.sections[this.presenting.section], `section-${this.presenting.section}`), { prio: 2 })) {
        this.presenting.said = true;
        this.introduced.add(this.presenting.section);
      }
    }
    // On small screens Max stays in the navbar, so introduce sections as they come into view
    if (this.compact && tg.section && LINES.sections[tg.section] && !this.introduced.has(tg.section) && this.frame % 15 === 0) {
      if (this.say(pick(LINES.sections[tg.section], `section-${tg.section}`), { prio: 1 })) this.introduced.add(tg.section);
    }

    // Mood: nap after a long idle, chat a little when the visitor has been quiet, fidget now and then
    const speed = Math.hypot(s.vx, s.vy);
    const idleFor = now - s.lastInput;
    if (!s.sleeping && idleFor > SLEEP_AFTER && !this.speaking && !this.curtain && !this.presenting) {
      s.sleeping = true;
      s.sleptAt = now;
    }
    if (!s.sleeping && !this.speaking && !this.curtain && now - this.lastTalk > IDLE_CHAT_AFTER && this.idleChats < 2) {
      if (this.say(pick(LINES.idle, 'idle'), { prio: 1 })) this.idleChats += 1;
    }
    if (speed < 60 && !s.sleeping && now > s.nextFidget) {
      engine.playOnce('Idle_2');
      s.nextFidget = now + 9000 + Math.random() * 7000;
    }

    // Flight pose from speed
    if (Math.abs(s.vx) > 40) s.dir = Math.sign(s.vx);
    if (this.curtain === 'tow') s.dir = -1;
    if (this.curtain === 'tow' || speed > 650) engine.setBase('Glide');
    else if (speed > 160) engine.setBase('Gallop', clamp(speed / 900, 0.45, 0.9));
    else if (s.sleeping) engine.setBase('Idle_2_HeadLow', 0.6);
    else engine.setBase('Idle');

    // Facing: profile into fast flight; otherwise turn towards the cursor (or the page centre)
    let facing;
    const lookAtX = s.cursor && finePointer ? s.cursor.x : vw / 2;
    if (this.curtain === 'tow' || speed > 260) {
      facing = s.dir * 1.25;
    } else {
      facing = clamp((lookAtX - s.cx) / 90, -1, 1) * 0.95;
      if (s.sleeping) facing = (s.cx < vw / 2 ? 1 : -1) * 0.5;
    }
    const tilt = reducedMotion ? 0 : clamp(-s.vx * 0.00035, -0.3, 0.3);
    const pitch = reducedMotion ? 0 : clamp(s.vy * 0.00025, -0.2, 0.2);

    // Head tracking target: the cursor projected in front of Max (or straight at the viewer)
    let lookTarget = null;
    if (!s.sleeping && s.cursor && finePointer && !reducedMotion) {
      lookTarget = engine.pageToWorld(s.cursor.x, s.cursor.y, s.cx, s.cy, box);
    } else if (!s.sleeping) {
      lookTarget = engine.camera.position.clone();
    }

    engine.update(dt, this.t, {
      still: reducedMotion,
      facing,
      tilt,
      pitch,
      lookTarget,
      sleeping: s.sleeping,
      speed: clamp(speed / 900, 0, 1),
    });
    engine.render();

    // Speech bubble beside his head, and "zzz" while he naps
    const head = engine.headOnPage(s.cx, s.cy, box);
    if (this.bubble.classList.contains('is-visible')) this.placeBubble(head.x, head.y, box, vw, vh);
    this.zzz.classList.toggle('is-visible', s.sleeping && !this.hidden);
    if (s.sleeping) this.zzz.style.transform = `translate3d(${(head.x + box * 0.08).toFixed(1)}px, ${(head.y - box * 0.18).toFixed(1)}px, 0)`;
  }

  placeBubble(headX, headY, box, vw, vh) {
    const half = box * 0.22;
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
  const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(MODEL_URL);
  return new Max(THREE, RoomEnvironment, gltf);
}

(function boot() {
  if (!webglAvailable()) return;

  let hidden = storage.hidden();
  let max = null;
  let loading = null;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'bot-toggle glass-card';
  toggle.innerHTML = '<i class="fas fa-paw text-sm" aria-hidden="true"></i>';
  const syncToggle = () => {
    toggle.setAttribute('aria-pressed', hidden ? 'false' : 'true');
    toggle.setAttribute('aria-label', hidden ? 'Show Max, the robo-wolf guide' : 'Hide Max, the robo-wolf guide');
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
