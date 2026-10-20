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
 *   each section heading as it scrolls into view to introduce it; hovers by the hero terminal; flies
 *   into the section-transition portal; perches at the screen edge while you read; naps when you go idle.
 * - On touch screens and narrow windows he hovers in the empty middle of the navbar instead.
 * - The robot button in the bottom-left corner hides or shows Max; the choice is remembered.
 * - Honors prefers-reduced-motion: Max holds still, does not chase the cursor, and does not type letter by letter.
 */

const HIDDEN_KEY = 'ky-bot-hidden';
const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const UNPROMPTED_GAP = 3500;   // minimum gap between lines Max starts on his own
const HOVER_DWELL = 450;       // how long the pointer must rest on something before Max explains it
const HOVER_COOLDOWN = 20000;  // before he explains the same element again
const SKILL_COOLDOWN = 4000;
const SLEEP_AFTER = 45000;
const IDLE_CHAT_AFTER = 8000;  // small talk after this long without speaking (while someone is around)
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

// A line is a string, or a list of parts { t: text, e: expression, g: gesture }. As the typing reaches
// a part, Max switches to its expression (idle, happy, love, wow, think, cool, wink, surprised, sad,
// blush, dizzy, sleepy) and plays its gesture (nod, hop, spin, wave, wag), so he reacts mid-sentence.
const LINES = {
  greet: () => [
    { t: `Good ${timeOfDay()}!`, e: 'love' },
    { t: " I'm Max, Kritagya's robo-wolf guide.", e: 'love', g: 'wave' },
  ],
  greetFollow: {
    desktop: [[{ t: 'Point at anything on this page', e: 'think' }, { t: " and I'll tell you all about it!", e: 'happy', g: 'wag' }]],
    touch: [[{ t: 'Tap anything on this page', e: 'think' }, { t: " and I'll tell you all about it!", e: 'happy', g: 'wag' }]],
  },
  portal: (label) => [`Opening a portal to ${label}!`, `Warping to ${label}...`, `Next stop: ${label}!`],
  sections: {
    about: [
      [{ t: "This is the 'who is Kritagya' part.", e: 'happy' }, { t: ' Short version: Java, Spring Boot, and lots of tests.', e: 'cool', g: 'nod' }],
      [{ t: 'B.Tech CSE, graduating 2027.', e: 'happy' }, { t: ' Backend is his thing!', e: 'love', g: 'wag' }],
    ],
    skills: [
      [{ t: 'His toolbox:', e: 'happy' }, { t: ' 52 skills across 8 categories!', e: 'wow', g: 'hop' }],
      [{ t: 'Spring Boot, PostgreSQL, Redis, Docker...', e: 'cool' }, { t: " point at any tile and I'll explain it.", e: 'happy' }],
    ],
    experience: [
      [{ t: 'His internship at Compass:', e: 'happy' }, { t: ' 50 merged commits and 25+ defects addressed!', e: 'wow', g: 'hop' }],
      [{ t: 'Software Engineering & QA Intern at an AI travel startup.', e: 'cool' }, { t: ' Real bugs, real fixes.', e: 'happy', g: 'nod' }],
    ],
    projects: [[{ t: 'Three backend builds!', e: 'wow' }, { t: ' Click any card for the full breakdown.', e: 'happy' }]],
    learning: [[{ t: "What he's studying next:", e: 'think' }, { t: ' microservices, Kafka and Kubernetes.', e: 'happy' }]],
    education: [[{ t: 'B.Tech CSE at KCC ITM, CGPA 7.58.', e: 'happy' }, { t: ' Plus two certifications!', e: 'wow' }]],
    'github-activity': [[{ t: 'Live numbers straight from GitHub.', e: 'cool' }, { t: ' Java leads the pack!', e: 'love' }]],
    contact: [
      [{ t: "Here's how to reach him.", e: 'happy' }, { t: " Email is fastest; there's a copy button!", e: 'love', g: 'wave' }],
      [{ t: "He's open to backend roles and internships.", e: 'love' }, { t: ' Just saying!', e: 'wink' }],
    ],
  },
  filters: {
    all: [{ t: 'All three projects,', e: 'happy' }, { t: ' back with the pack!', e: 'love', g: 'wag' }],
    concurrency: [{ t: 'High concurrency:', e: 'cool' }, { t: " that's the Event Booking System.", e: 'wow' }],
    devops: [{ t: 'Cloud & DevOps:', e: 'cool' }, { t: ' LinkPulse ships itself to Render.', e: 'happy', g: 'nod' }],
    security: [{ t: 'Security & APIs:', e: 'cool' }, { t: ' the Event Booking System and KeyVault.', e: 'happy', g: 'nod' }],
  },
  copied: [[{ t: 'Fetched!', e: 'happy', g: 'hop' }, { t: ' His email is on your clipboard.', e: 'love', g: 'wag' }]],
  themeLight: [[{ t: 'Too bright!', e: 'surprised' }, { t: ' My LEDs are squinting.', e: 'wink' }]],
  themeDark: [[{ t: 'Ahh, night mode.', e: 'happy' }, { t: ' Wolf hours!', e: 'love', g: 'wag' }]],
  poke: [
    [{ t: 'Beep-awoo!', e: 'surprised', g: 'hop' }, { t: ' That tickles!', e: 'blush' }],
    [{ t: 'Tip:', e: 'wink' }, { t: ' press Ctrl+K to jump anywhere.', e: 'happy' }],
    [{ t: 'Tip:', e: 'wink' }, { t: ' press ? for keyboard shortcuts.', e: 'happy' }],
    [{ t: 'Robot body,', e: 'cool' }, { t: ' wolf heart.', e: 'love', g: 'wag' }],
    [{ t: 'Running on Java', e: 'happy' }, { t: ' and jet fuel!', e: 'wow', g: 'spin' }],
  ],
  dizzy: [[{ t: 'Okay, okay!', e: 'dizzy' }, { t: " I'm dizzy now...", e: 'dizzy' }]],
  wake: [[{ t: 'Huh?!', e: 'surprised', g: 'hop' }, { t: " I'm up, I'm up!", e: 'happy' }]],
  hide: [[{ t: 'Powering down...', e: 'sad' }, { t: ' The robot button wakes me up.', e: 'wink' }]],
  show: [[{ t: 'Systems online!', e: 'wow', g: 'spin' }, { t: ' Max is back!', e: 'love', g: 'wave' }]],
  petting: [
    [{ t: 'Hehe!', e: 'blush' }, { t: ' Head pats accepted.', e: 'love', g: 'wag' }],
    [{ t: 'Oh, hi!', e: 'surprised' }, { t: ' Need anything? Just point at it.', e: 'happy' }],
    [{ t: 'That tickles!', e: 'blush', g: 'hop' }],
  ],
  // Small talk when things are quiet (only while someone is actually around)
  chatter: [
    [{ t: 'Fun fact:', e: 'think' }, { t: ' LinkPulse runs its tests against a live database before every deploy.', e: 'wow' }],
    [{ t: 'Did you know?', e: 'think' }, { t: ' At Compass he helped stop a 500-request burst from slipping past a limit of 10.', e: 'wow', g: 'hop' }],
    [{ t: 'Tip:', e: 'wink' }, { t: ' click any project card for the full story.', e: 'happy' }],
    [{ t: 'Psst...', e: 'wink' }, { t: ' Ctrl+K jumps anywhere on this page.', e: 'happy' }],
    [{ t: 'Tip:', e: 'wink' }, { t: ' press ? to see every keyboard shortcut.', e: 'happy' }],
    [{ t: "I'm built entirely from code,", e: 'happy' }, { t: ' no model files. Robot body, wolf heart!', e: 'blush', g: 'spin' }],
    [{ t: 'The Event Booking System has 83 endpoints.', e: 'wow' }, { t: ' I counted. Twice.', e: 'wink' }],
    [{ t: 'Point at any skill', e: 'think' }, { t: " and I'll explain what it is.", e: 'happy', g: 'wag' }],
    () => {
      const row = document.querySelector('#lang-list .lang-row');
      if (!row) return null;
      const name = row.querySelector('.lang-name').textContent;
      const pct = row.querySelector('.lang-pct').textContent;
      return [{ t: `${name} makes up ${pct} of the code in his public repos.`, e: 'love' }, { t: ' Check the language card!', e: 'happy' }];
    },
    [{ t: 'He graduates in 2027.', e: 'happy' }, { t: ' Recruiters, take note!', e: 'wink', g: 'wave' }],
    [{ t: 'Two kinds of locks,', e: 'cool' }, { t: ' one booking per seat. Concurrency is fun!', e: 'happy', g: 'nod' }],
    [{ t: 'Want to say hi to him?', e: 'love' }, { t: ' The Contact section has a copy-email button.', e: 'happy' }],
    [{ t: "Still here? I'm enjoying the company.", e: 'blush', g: 'wag' }],
  ],
  // Things Max notices about what you are doing
  situations: {
    scrollFast: [
      [{ t: 'Whoa, whoa!', e: 'dizzy' }, { t: ' Speed-reading?', e: 'surprised' }],
      [{ t: 'Wheee!', e: 'dizzy', g: 'spin' }, { t: ' Slow down, the good stuff is in here!', e: 'happy' }],
    ],
    bottom: [[{ t: 'You made it to the very end!', e: 'love', g: 'hop' }, { t: ' Thanks for visiting.', e: 'blush', g: 'wave' }]],
    welcomeBack: [[{ t: 'You came back!', e: 'love', g: 'hop' }, { t: ' I kept your spot warm.', e: 'blush' }]],
    select: [
      [{ t: 'Copying something?', e: 'surprised' }, { t: ' Good taste.', e: 'wink' }],
      [{ t: 'Taking notes?', e: 'think' }, { t: ' I like you already.', e: 'blush' }],
    ],
    shake: [[{ t: 'Wheee!', e: 'happy', g: 'spin' }, { t: ' Where are we going?', e: 'surprised' }]],
    leave: [[{ t: "Wait, don't go!", e: 'sad' }], [{ t: 'Come back soon...', e: 'sad' }]],
    resize: [[{ t: 'Ooh, stretchy!', e: 'surprised', g: 'hop' }]],
  },
};

/* ------------------------------------------------------------------------------------------------
 * Explanations: what Max says when the pointer rests on something (or it is tapped on a phone)
 * ---------------------------------------------------------------------------------------------- */

// Every skill, chip, and tag on the page, keyed by its lowercase text
const SKILL_TALK = {
  java: [{ t: 'Java!', e: 'love', g: 'wag' }, { t: ' His main language: typed, fast, and the engine behind both of his Spring Boot systems.', e: 'happy' }],
  sql: [{ t: 'SQL', e: 'cool' }, { t: ' is how he talks to databases: selects, joins, indexes, the works.', e: 'happy' }],
  javascript: [{ t: 'JavaScript runs in the browser.', e: 'happy' }, { t: ' He knows the basics; his heart is in the backend.', e: 'wink' }],
  react: [{ t: 'React builds interfaces from components.', e: 'think' }, { t: ' The Event Booking System has a React frontend.', e: 'happy' }],
  html: [{ t: 'HTML is the skeleton of every web page.', e: 'happy' }, { t: ' He knows it at a basic level.', e: 'wink' }],
  css: [{ t: 'CSS makes pages look good.', e: 'happy' }, { t: ' Basic level, but hey, he has me!', e: 'blush' }],
  'spring boot': [{ t: 'Spring Boot!', e: 'love', g: 'hop' }, { t: ' A Java framework that gets a production-ready backend running fast. Both big projects use it.', e: 'happy' }],
  'spring mvc': [{ t: 'Spring MVC', e: 'think' }, { t: ' maps web requests to controller methods. That is how REST endpoints get wired up.', e: 'happy' }],
  'spring security': [{ t: 'Spring Security', e: 'cool' }, { t: ' guards the doors: logins, tokens and who may do what.', e: 'happy', g: 'nod' }],
  'spring data jpa': [{ t: 'Spring Data JPA', e: 'happy' }, { t: ' turns Java interfaces into database queries. Less boilerplate!', e: 'wow' }],
  hibernate: [{ t: 'Hibernate', e: 'think' }, { t: ' maps Java objects to database tables. It is what JPA uses under the hood.', e: 'happy' }],
  'restful api design': [{ t: 'REST APIs:', e: 'cool' }, { t: ' clean URLs, the right HTTP verbs, predictable JSON.', e: 'happy' }, { t: ' He has built 83+ endpoints!', e: 'wow', g: 'hop' }],
  'restful apis': [{ t: 'REST APIs:', e: 'cool' }, { t: ' clean URLs, the right HTTP verbs, predictable JSON.', e: 'happy' }, { t: ' He has built 83+ endpoints!', e: 'wow', g: 'hop' }],
  'websocket (stomp)': [{ t: 'WebSockets keep a live connection open.', e: 'think' }, { t: ' In the Event Booking System, seat updates arrive instantly!', e: 'wow' }],
  postgresql: [{ t: 'PostgreSQL', e: 'love' }, { t: ' is his go-to database: reliable, relational, and great with indexes.', e: 'happy', g: 'nod' }],
  mysql: [{ t: 'MySQL,', e: 'happy' }, { t: ' another popular relational database in his kit.', e: 'cool' }],
  redis: [{ t: 'Redis is lightning fast!', e: 'wow', g: 'hop' }, { t: ' It keeps data in memory, which makes it perfect for caching.', e: 'happy' }],
  'sql queries & joins': [{ t: 'Joins', e: 'think' }, { t: ' stitch rows from different tables together. Simple ones, complex ones, he writes both.', e: 'cool' }],
  indexing: [{ t: 'Indexes are like the index of a book:', e: 'think' }, { t: ' the database finds rows without reading everything. LinkPulse lookups are indexed.', e: 'cool', g: 'nod' }],
  'schema design': [{ t: 'Schema design', e: 'think' }, { t: ' means planning tables and relations before writing code. The Event Booking System has 13 JPA entities!', e: 'wow' }],
  'jwt authentication': [{ t: 'JWTs are signed tokens', e: 'cool' }, { t: ' that prove who you are, so every request can be checked without a session.', e: 'happy', g: 'nod' }],
  'refresh token rotation': [{ t: 'Refresh token rotation:', e: 'think' }, { t: ' each refresh hands out a brand-new token and retires the old one.', e: 'cool' }, { t: ' Stolen tokens stop working!', e: 'wow' }],
  'role-based access control': [{ t: 'RBAC:', e: 'cool' }, { t: ' users get roles, roles get permissions. Admins do admin things; nobody else can.', e: 'wink' }],
  'bcrypt password hashing': [{ t: 'BCrypt', e: 'cool' }, { t: ' hashes passwords with a salt and a deliberately slow algorithm, so leaked hashes are hard to crack.', e: 'happy', g: 'nod' }],
  'optimistic locking': [{ t: 'Optimistic locking:', e: 'think' }, { t: ' everyone may edit, but a version number catches the loser of a race.', e: 'cool' }, { t: ' That @Version field!', e: 'wow', g: 'nod' }],
  'pessimistic locking': [{ t: 'Pessimistic locking', e: 'cool' }, { t: ' locks the row first, so nobody else can touch it until you are done.', e: 'happy', g: 'nod' }],
  docker: [{ t: 'Docker', e: 'happy' }, { t: ' packs an app and everything it needs into a container that runs the same everywhere.', e: 'cool' }],
  'docker compose': [{ t: 'Docker Compose', e: 'happy' }, { t: ' starts several containers together, like an app plus its database.', e: 'cool' }],
  'multi-stage builds': [{ t: 'Multi-stage builds', e: 'think' }, { t: ' compile in one stage and ship only the result.', e: 'cool' }, { t: ' LinkPulse uses a 3-stage build!', e: 'wow' }],
  'github actions (ci/cd)': [{ t: 'GitHub Actions', e: 'cool' }, { t: ' runs his tests automatically. LinkPulse tests against a live database before every deploy.', e: 'wow', g: 'nod' }],
  'github actions': [{ t: 'GitHub Actions', e: 'cool' }, { t: ' runs his tests automatically. LinkPulse tests against a live database before every deploy.', e: 'wow', g: 'nod' }],
  render: [{ t: 'Render', e: 'happy' }, { t: ' is the cloud host where LinkPulse runs live.', e: 'cool' }],
  nginx: [{ t: 'Nginx', e: 'cool' }, { t: ' is a fast web server and reverse proxy.', e: 'happy' }],
  'junit 5': [{ t: 'JUnit 5', e: 'happy' }, { t: " is Java's testing framework. LinkPulse alone has 39 JUnit and Mockito tests!", e: 'wow', g: 'hop' }],
  mockito: [{ t: 'Mockito', e: 'wink' }, { t: ' fakes dependencies, so a test checks just one piece at a time.', e: 'happy' }],
  mockmvc: [{ t: 'MockMvc', e: 'cool' }, { t: ' tests REST controllers with pretend HTTP requests, no server needed.', e: 'happy' }],
  'unit testing': [{ t: 'Unit tests', e: 'happy' }, { t: ' check small pieces of code on their own.', e: 'cool', g: 'nod' }],
  'integration testing': [{ t: 'Integration tests', e: 'think' }, { t: ' check that the pieces work together, like code plus a real database.', e: 'happy' }],
  'manual & exploratory testing': [{ t: 'Exploratory testing:', e: 'think' }, { t: ' poking at an app like a curious user to find bugs scripts miss.', e: 'wink' }, { t: ' He did that as a QA intern!', e: 'happy' }],
  'bean validation': [{ t: 'Bean Validation', e: 'cool' }, { t: ' checks inputs with annotations like @NotNull, before bad data gets anywhere.', e: 'happy' }],
  'git & github': [{ t: 'Git tracks every change;', e: 'happy' }, { t: ' GitHub hosts his repositories.', e: 'cool' }],
  maven: [{ t: 'Maven', e: 'happy' }, { t: ' builds Java projects and fetches their libraries.', e: 'cool' }],
  'intellij idea': [{ t: 'IntelliJ IDEA,', e: 'happy' }, { t: ' the Java IDE where the code gets written.', e: 'cool' }],
  postman: [{ t: 'Postman', e: 'happy' }, { t: ' sends test requests to APIs. Handy for poking endpoints!', e: 'wink' }],
  'swagger / openapi': [{ t: 'Swagger / OpenAPI', e: 'think' }, { t: ' documents an API so anyone can read and try every endpoint.', e: 'happy' }],
  'claude code': [{ t: "Hey, that's a cousin of mine!", e: 'blush', g: 'wag' }, { t: ' Claude Code is an AI coding assistant. He used it during his internship and holds the Anthropic certification.', e: 'happy' }],
  'linux cli': [{ t: 'The Linux command line:', e: 'cool' }, { t: ' where servers live.', e: 'wink' }],
  'data structures & algorithms': [{ t: 'DSA:', e: 'think' }, { t: ' arrays, trees, graphs, and the clever ways to use them.', e: 'happy' }],
  'data structures': [{ t: 'Data structures:', e: 'think' }, { t: ' arrays, trees, graphs, and the clever ways to use them.', e: 'happy' }],
  'oop & solid': [{ t: 'OOP and SOLID:', e: 'think' }, { t: ' principles for code that is easy to extend and hard to break.', e: 'cool' }],
  'object-oriented programming': [{ t: 'Object-oriented programming:', e: 'think' }, { t: ' modeling code as objects with clear responsibilities.', e: 'happy' }],
  'system design': [{ t: 'System design', e: 'think' }, { t: ' is planning how the pieces of a big system fit, scale, and fail gracefully.', e: 'cool' }],
  'system design & architecture': [{ t: 'System design', e: 'think' }, { t: ' is planning how the pieces of a big system fit, scale, and fail gracefully.', e: 'cool' }],
  'concurrency control': [{ t: 'Concurrency control', e: 'cool' }, { t: ' keeps data correct when many users act at once.', e: 'happy' }, { t: ' Hello, no double-booking!', e: 'wow' }],
  dbms: [{ t: 'DBMS:', e: 'think' }, { t: ' how databases store, query and protect data.', e: 'happy' }],
  'dbms & sql': [{ t: 'DBMS and SQL:', e: 'think' }, { t: ' how databases store, query and protect data.', e: 'happy' }],
  'operating systems': [{ t: 'Operating systems:', e: 'think' }, { t: ' processes, threads, memory. The stuff under everything.', e: 'cool' }],
  'computer networks': [{ t: 'Computer networks:', e: 'think' }, { t: ' how data travels, from TCP to HTTP.', e: 'cool' }],
  'jwt & rbac': [{ t: 'JWT and RBAC:', e: 'cool' }, { t: ' tokens prove who you are; roles decide what you can do.', e: 'happy', g: 'nod' }],
  'junit 5 & mockito': [{ t: 'JUnit 5 and Mockito:', e: 'happy' }, { t: ' the testing duo. LinkPulse alone has 39 tests!', e: 'wow' }],
  'java & spring boot': [{ t: 'His core:', e: 'love' }, { t: ' Java with Spring Boot.', e: 'happy', g: 'wag' }],
  'postgresql & redis': [{ t: 'PostgreSQL stores the data;', e: 'cool' }, { t: ' Redis makes it fast.', e: 'wow' }],
  'docker & ci/cd': [{ t: 'Containers plus automated pipelines:', e: 'cool' }, { t: ' code that ships itself!', e: 'wow' }],
  'jwt & rbac security': [{ t: 'Tokens prove who you are;', e: 'cool' }, { t: ' roles decide what you can do.', e: 'happy', g: 'nod' }],
  'spring cloud': [{ t: 'Spring Cloud:', e: 'think' }, { t: ' tools for building microservices. On his learning list!', e: 'happy' }],
  eureka: [{ t: 'Eureka', e: 'think' }, { t: ' lets microservices find each other.', e: 'happy' }],
  resilience4j: [{ t: 'Resilience4j', e: 'cool' }, { t: ' adds circuit breakers, so one failing service does not take down the rest.', e: 'happy' }],
  'apache kafka': [{ t: 'Kafka', e: 'wow' }, { t: ' streams events between services at huge scale.', e: 'cool' }],
  rabbitmq: [{ t: 'RabbitMQ', e: 'happy' }, { t: ' is a message broker: services drop messages, others pick them up.', e: 'cool' }],
  kubernetes: [{ t: 'Kubernetes', e: 'cool' }, { t: ' runs and scales containers automatically.', e: 'wow' }],
  aws: [{ t: 'AWS:', e: 'happy' }, { t: " Amazon's cloud. Next on his list.", e: 'cool' }],
  terraform: [{ t: 'Terraform', e: 'think' }, { t: ' describes infrastructure as code.', e: 'cool' }],
  'concurrency testing': [{ t: 'Concurrency tests', e: 'cool' }, { t: ' fire many requests at once to catch race conditions,', e: 'think' }, { t: ' like that rate-limit bug!', e: 'wow' }],
  'api validation': [{ t: 'API validation', e: 'cool' }, { t: ' rejects bad input early, like checking what is really inside an upload.', e: 'happy' }],
  'android device testing': [{ t: 'Android device testing,', e: 'happy' }, { t: ' directed and reviewed with AI assistance.', e: 'cool' }],
};

const NAV_TALK = {
  About: [{ t: 'About:', e: 'happy' }, { t: " who he is, in a nutshell. Click and I'll open a portal!", e: 'cool' }],
  Skills: [{ t: 'Skills:', e: 'happy' }, { t: ' 52 of them in 8 categories.', e: 'wow' }],
  Experience: [{ t: 'Experience:', e: 'happy' }, { t: ' his internship at Compass.', e: 'cool' }],
  Projects: [{ t: 'Projects:', e: 'happy' }, { t: ' three backend builds. My favorite part!', e: 'love' }],
  Learning: [{ t: 'Learning:', e: 'think' }, { t: " what he's studying next.", e: 'happy' }],
  Education: [{ t: 'Education:', e: 'happy' }, { t: ' his B.Tech and two certifications.', e: 'cool' }],
  Contact: [{ t: 'Contact:', e: 'love' }, { t: ' how to reach him!', e: 'happy', g: 'wave' }],
};

const FILTER_TALK = {
  all: [{ t: 'All three projects', e: 'happy' }, { t: ' in one place.', e: 'cool' }],
  concurrency: [{ t: 'High concurrency:', e: 'cool' }, { t: ' lots of users at once without breaking anything.', e: 'wow' }],
  devops: [{ t: 'Cloud & DevOps:', e: 'cool' }, { t: ' containers, pipelines and deploys.', e: 'happy' }],
  security: [{ t: 'Security & APIs:', e: 'cool' }, { t: ' tokens, roles and locked-down endpoints.', e: 'happy', g: 'nod' }],
};

const SKILL_TAB_TALK = {
  languages: [{ t: 'Languages:', e: 'happy' }, { t: ' Java and SQL first, plus basic JavaScript, React, HTML and CSS.', e: 'cool' }],
  backend: [{ t: 'Backend & APIs:', e: 'love' }, { t: ' the Spring family and REST. His home turf.', e: 'happy', g: 'wag' }],
  databases: [{ t: 'Databases:', e: 'happy' }, { t: ' PostgreSQL for truth, Redis for speed.', e: 'cool' }],
  security: [{ t: 'Security & Concurrency:', e: 'cool' }, { t: ' tokens, roles, hashing and locks.', e: 'happy', g: 'nod' }],
  devops: [{ t: 'Cloud & DevOps:', e: 'happy' }, { t: ' Docker in, Render out, GitHub Actions in between.', e: 'cool' }],
  testing: [{ t: 'Testing:', e: 'happy' }, { t: ' JUnit, Mockito and MockMvc keep the bugs honest.', e: 'wink' }],
  tools: [{ t: 'Tools:', e: 'happy' }, { t: ' IntelliJ, Postman, Swagger, Claude Code... the daily kit.', e: 'cool' }],
  core: [{ t: 'Core CS:', e: 'think' }, { t: ' the theory underneath the code.', e: 'happy' }],
};

// Numbers on the page: hero and About stats, project metrics, and the internship's key numbers
const NUMBER_TALK = [
  [/merged commits/, [{ t: '50 merged commits', e: 'wow', g: 'hop' }, { t: ' in just over five weeks at Compass!', e: 'happy' }]],
  [/defects/, [{ t: '25+ QA-reported defects,', e: 'surprised' }, { t: ' investigated, fixed and validated with tests.', e: 'cool', g: 'nod' }]],
  [/rate-limit/, [{ t: '30 routes', e: 'think' }, { t: ' were covered by the rate-limit fix. One atomic update to guard them all!', e: 'cool' }]],
  [/distance/, [{ t: 'The 25 km rule!', e: 'happy' }, { t: ' One itinerary day once spanned about 130 km. Not anymore.', e: 'wink' }]],
  [/controllers/, [{ t: '16 controllers', e: 'think' }, { t: ' split those endpoints into tidy areas.', e: 'happy' }]],
  [/JPA entities/, [{ t: '13 JPA entities:', e: 'think' }, { t: ' the tables behind events, seats, bookings and more.', e: 'cool' }]],
  [/security regression/, [{ t: 'A 6-test security regression suite,', e: 'cool' }, { t: ' so fixed holes stay fixed.', e: 'happy', g: 'nod' }]],
  [/JUnit\/Mockito/, [{ t: '39 JUnit and Mockito tests!', e: 'wow' }, { t: ' Collision handling included.', e: 'cool', g: 'nod' }]],
  [/Docker build/, [{ t: 'A 3-stage Docker build:', e: 'think' }, { t: ' build, prune, then ship a slim, non-root Java runtime.', e: 'cool' }]],
  [/^\s*5\s*REST/, [{ t: 'Just 5 endpoints.', e: 'happy' }, { t: ' Small, sharp, and live in production.', e: 'cool' }]],
  [/83\s*REST endpoints/, [{ t: '83 REST endpoints!', e: 'wow', g: 'hop' }, { t: ' Seats, payments and tickets, all behind clean APIs.', e: 'happy' }]],
  [/83/, [{ t: '83+ REST APIs!', e: 'wow', g: 'hop' }, { t: ' Designed and deployed across two Spring Boot systems.', e: 'happy' }]],
  [/45/, [{ t: '45+ automated tests:', e: 'cool' }, { t: ' 39 in LinkPulse plus a 6-test security suite in the Event Booking System.', e: 'happy', g: 'nod' }]],
  [/7\.58/, [{ t: 'A 7.58 CGPA', e: 'happy' }, { t: ' in B.Tech Computer Science, graduating 2027.', e: 'love', g: 'wag' }]],
];

// The internship highlights, one by one
const BULLET_TALK = [
  [/50 merged commits/, [{ t: '50 merged commits', e: 'wow' }, { t: ' with Claude as his AI pair programmer.', e: 'blush' }, { t: ' Every fix was reviewed and tested.', e: 'cool', g: 'nod' }]],
  [/race condition/, [{ t: 'Picture this:', e: 'think' }, { t: ' 500 requests rushing past a limit of 10!', e: 'surprised' }, { t: ' An atomic database update made check-and-count a single step, and the limit held.', e: 'cool', g: 'nod' }]],
  [/trip editing/, [{ t: 'Real product fixes:', e: 'happy' }, { t: ' trip access vs traveler count, upload checks,', e: 'think' }, { t: ' and flight fares that got multiplied by passengers. Oops!', e: 'surprised' }]],
  [/25 km/, [{ t: 'One itinerary day spanned about 130 km!', e: 'surprised' }, { t: ' A 25 km rule keeps each day realistic now.', e: 'happy', g: 'nod' }]],
  [/WhatsApp agent/, [{ t: 'Hands-on testing', e: 'cool' }, { t: ' of an AI WhatsApp agent, plus Instagram Reel and YouTube links.', e: 'think' }, { t: ' And AI-assisted Android testing!', e: 'happy' }]],
];

function istTime() {
  const el = document.getElementById('live-ist-time');
  return el ? el.textContent.trim() : '';
}

// Rules in priority order (buttons and links before the cards that contain them). `say` is a line, a
// list of lines (one is picked), or a function of the element returning either.
const TALK = [
  { sel: '.bot-toggle', say: [[{ t: 'That button hides me...', e: 'sad' }, { t: " I'd miss you, though.", e: 'blush' }]] },
  { sel: '#back-to-top', say: [[{ t: 'Back to the top?', e: 'surprised' }, { t: ' Wheee!', e: 'happy', g: 'spin' }]] },
  { sel: '.theme-toggle', say: () => (root.getAttribute('data-theme') === 'light'
    ? [{ t: 'Back to night mode?', e: 'happy' }, { t: ' Wolf hours!', e: 'love', g: 'wag' }]
    : [{ t: 'Light mode?', e: 'surprised' }, { t: ' My LEDs will squint!', e: 'wink' }]) },
  { sel: '#cmd-palette-trigger', say: [[{ t: 'The command palette!', e: 'wow' }, { t: ' Ctrl+K finds sections, filters, the theme switch and his resume.', e: 'happy' }]] },
  { sel: 'a[download]', say: [
    [{ t: 'His resume!', e: 'love', g: 'hop' }, { t: ' One page, all signal.', e: 'cool', g: 'nod' }],
    [{ t: 'The PDF version of everything here.', e: 'happy' }, { t: ' Recruiters love this button.', e: 'love', g: 'wag' }],
  ] },
  { sel: 'a.btn-primary[href="#contact"]', say: [[{ t: 'Ooh, hiring?', e: 'love', g: 'hop' }, { t: " He's open to backend roles and internships!", e: 'happy', g: 'wave' }]] },
  { sel: '.copy-email-btn', say: [[{ t: 'One click', e: 'happy' }, { t: ' and his email is on your clipboard!', e: 'love', g: 'wag' }]] },
  { sel: 'a[href^="mailto:"]', say: [[{ t: 'His inbox!', e: 'love', g: 'wave' }, { t: ' kritagyay2006@gmail.com. Say hi!', e: 'happy' }]] },
  { sel: 'a[href^="tel:"]', say: [[{ t: 'His phone:', e: 'happy' }, { t: ' +91-8368099806.', e: 'cool' }]] },
  { sel: 'a[href*="linkedin.com"]', say: [[{ t: 'His LinkedIn:', e: 'happy' }, { t: ' the professional side of things.', e: 'cool', g: 'nod' }]] },
  { sel: 'a[href*="leetcode.com"]', say: [[{ t: 'LeetCode!', e: 'cool' }, { t: ' Where the algorithms get practiced.', e: 'think' }]] },
  { sel: 'a[href*="linkpulse-frontend"]', say: [[{ t: "LinkPulse's live demo!", e: 'wow' }, { t: ' It runs on Render. Go on, shorten a link.', e: 'wink', g: 'wave' }]] },
  { sel: '[data-open-arch]', say: [[{ t: 'The architecture deep dive!', e: 'wow' }, { t: ' Seat locks, versions and live updates in one diagram.', e: 'happy', g: 'nod' }]] },
  { sel: '.project-explore', say: [[{ t: 'Opens the full story:', e: 'happy' }, { t: ' metrics, highlights and the tech stack.', e: 'cool' }]] },
  { sel: 'a.project-action[href*="github.com"]', say: [[{ t: 'The source code,', e: 'happy' }, { t: ' open on GitHub.', e: 'cool', g: 'nod' }]] },
  { sel: 'a[href*="github.com/kritagya025"]', say: [[{ t: 'His GitHub:', e: 'happy' }, { t: ' where all the source code lives.', e: 'cool', g: 'nod' }]] },
  { sel: '#shortcuts-trigger-btn', say: [[{ t: 'Press ? anytime', e: 'wink' }, { t: ' to see every keyboard shortcut.', e: 'happy' }]] },
  { sel: '.brand', say: [[{ t: 'KY: Kritagya Yadav.', e: 'happy' }, { t: ' Click it to fly back to the top.', e: 'wink' }]] },
  { sel: '#navbar .nav-link', say: (el) => NAV_TALK[el.textContent.trim()] },
  { sel: '.project-filter-btn', say: (el) => FILTER_TALK[el.dataset.filter] },
  { sel: '.skill-tab', say: (el) => SKILL_TAB_TALK[el.id.replace('skill-tab-', '')] },
  { sel: '.skill-tile, .chip, .course-chip, .focus-chip, .marquee-item', say: (el) => {
    const name = el.textContent.replace(/\s+/g, ' ').trim();
    return SKILL_TALK[name.toLowerCase()] || [{ t: `${name}!`, e: 'happy' }, { t: ' Part of his toolkit.', e: 'cool' }];
  } },
  { sel: '.metric, #top dl > div, .stat-card, .exp-card dl > div', say: (el) => {
    const found = NUMBER_TALK.find(([pattern]) => pattern.test(el.textContent));
    return found ? found[1] : null;
  } },
  { sel: '.exp-card .highlight-item', say: (el) => {
    const found = BULLET_TALK.find(([pattern]) => pattern.test(el.textContent));
    return found ? found[1] : null;
  } },
  { sel: '.exp-card', say: [[{ t: 'His internship:', e: 'happy' }, { t: ' Software Engineering & QA Intern at Compass (HeyCompass), an AI travel-planning startup, Aug to Oct 2026.', e: 'cool', g: 'nod' }]] },
  { sel: '[data-project-card="event-booking"]', say: [[{ t: 'The Event Booking System!', e: 'love' }, { t: ' 83 endpoints for seats, payments and tickets.', e: 'wow' }, { t: ' Two kinds of locks make sure nobody grabs the same seat.', e: 'cool', g: 'nod' }]] },
  { sel: '[data-project-card="linkpulse"]', say: [[{ t: 'LinkPulse:', e: 'happy' }, { t: ' a URL shortener live in production!', e: 'wow' }, { t: ' Every deploy waits for its tests to pass.', e: 'cool', g: 'nod' }]] },
  { sel: '[data-project-card="keyvault"]', say: [[{ t: 'KeyVault:', e: 'think' }, { t: ' a focused Spring Boot service for keys and credentials, with clean layers.', e: 'happy' }]] },
  { sel: '.code-card', say: [[{ t: 'See that @Version field?', e: 'think' }, { t: ' Every save bumps it.', e: 'happy' }, { t: ' If two bookings race, the slower one sees a stale version and fails. No double-booking!', e: 'cool', g: 'nod' }]] },
  { sel: '.hero-terminal', say: [[{ t: 'A tiny terminal:', e: 'think' }, { t: ' whoami, his stack, his projects, his tests.', e: 'happy' }, { t: ' Very on-brand.', e: 'wink' }]] },
  { sel: '.hero-name', say: [[{ t: "That's him!", e: 'love', g: 'hop' }, { t: ' Kritagya Yadav, Java backend developer.', e: 'happy', g: 'wag' }]] },
  { sel: '.role-pill', say: (el) => [{ t: `"${el.textContent.trim()}"`, e: 'cool' }, { t: ' is one of the roles that rotate here.', e: 'happy' }] },
  { sel: '.glass-card', text: /Available for Backend/, say: [[{ t: 'He is available', e: 'love' }, { t: ' for backend roles and internships!', e: 'happy', g: 'wave' }]] },
  { sel: '.glass-card', text: /Noida/, say: () => {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
    const late = hour >= 23 || hour < 6;
    return [{ t: `It's ${istTime()} in Noida right now.`, e: 'happy' }, { t: late ? ' He might be asleep... or debugging.' : ' A fine time to send an email!', e: late ? 'sleepy' : 'wink' }];
  } },
  { sel: '.glass-card', text: /KCC ITM/, say: [[{ t: 'B.Tech in Computer Science & Engineering', e: 'happy' }, { t: ' at KCC ITM, AKTU. Class of 2027!', e: 'love' }]] },
  { sel: '.glass-card', text: /Compass/, say: [[{ t: 'His internship at Compass!', e: 'wow' }, { t: ' The Experience section has the whole story.', e: 'happy' }]] },
  { sel: '#learning article', text: /Microservices/, say: [[{ t: 'Microservices:', e: 'think' }, { t: ' one big app split into small services that talk over the network.', e: 'cool' }, { t: " He's learning it now!", e: 'happy' }]] },
  { sel: '#learning article', text: /Message Queues/, say: [[{ t: 'Message queues!', e: 'think' }, { t: ' Services drop messages and others pick them up. Kafka and RabbitMQ are on his list.', e: 'happy' }]] },
  { sel: '#learning article', text: /Kubernetes/, say: [[{ t: 'Kubernetes', e: 'cool' }, { t: ' runs and scales containers automatically; AWS and Terraform come along for the ride.', e: 'happy' }]] },
  { sel: '#education article', text: /Claude Code in Action/, say: [[{ t: 'Claude Code in Action, from Anthropic!', e: 'blush', g: 'wag' }, { t: " That's family. Agentic coding workflows, March 2026.", e: 'happy' }]] },
  { sel: '#education article', text: /Cyber Job Simulation/, say: [[{ t: "Deloitte Australia's cyber job simulation", e: 'cool' }, { t: ' on Forage, 2024: vulnerabilities, risks and defenses.', e: 'think' }]] },
  { sel: '#education article', text: /KCC/, say: [[{ t: 'His degree:', e: 'happy' }, { t: ' B.Tech CSE at KCC Institute of Technology & Management, 2023 to 2027.', e: 'cool' }, { t: ' CGPA 7.58!', e: 'love' }]] },
  { sel: '.lang-row', say: (el) => {
    const name = el.querySelector('.lang-name').textContent;
    return [{ t: `${name}:`, e: name === 'Java' ? 'love' : 'happy' }, { t: ` ${el.querySelector('.lang-pct').textContent} of the code in his public repos.`, e: 'cool' }];
  } },
  { sel: '#lang-card', say: () => [{ t: 'Bytes of code, not opinions.', e: 'cool' }, { t: ` ${(document.getElementById('lang-primary') || {}).textContent || 'Java'} leads the pack!`, e: 'love', g: 'wag' }] },
  { sel: '.stat-card-img', say: (el) => (el.querySelector('img[alt*="Streak"]')
    ? [{ t: 'His GitHub streak!', e: 'wow' }, { t: ' Consistency is a superpower.', e: 'love' }]
    : [{ t: 'His live GitHub stats,', e: 'cool' }, { t: ' fetched fresh from his profile.', e: 'happy' }]) },
  { sel: '.section-title', say: (el) => {
    const section = el.closest('section');
    return section ? LINES.sections[section.id] : null;
  } },
  { sel: '.hero-scroll', say: [[{ t: 'Scroll down!', e: 'happy', g: 'hop' }, { t: ' It only gets better.', e: 'wink' }]] },
];

const lastPicked = new Map();
function pick(list, key) {
  if (list.length === 1) return list[0];
  let index;
  do { index = Math.floor(Math.random() * list.length); } while (index === lastPicked.get(key));
  lastPicked.set(key, index);
  return list[index];
}

/** A `say` source is one line (a string or a list of parts) or a list of lines to pick from. */
function resolveLine(source, key) {
  if (!source) return null;
  if (typeof source === 'function') return resolveLine(source(), key);
  const isList = Array.isArray(source) && source.length && (typeof source[0] === 'string' || Array.isArray(source[0]) || typeof source[0] === 'function');
  if (!isList) return source;
  const choice = pick(source, key);
  return typeof choice === 'function' ? choice() : choice;
}

/* ------------------------------------------------------------------------------------------------
 * Face: an LED dot matrix on Max's curved visor, showing a wolf
 * ---------------------------------------------------------------------------------------------- */

const COLS = 26;
const ROWS = 16;
const CELL = 20;
// Pattern cells: '#' bright LED, '+' dim LED, '*' heart LED, 'p' blush LED, '.' off
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
  star: ['..#..', '.###.', '#####', '.###.', '.#.#.'],
  blush: ['p.p.p'],
  nose: ['######', '.####.', '..##..'],
  mouthSmile: ['#..##..#', '.##..##.'],
  mouthTalk: ['#..##..#', '.######.', '..++++..'],
  mouthGrin: ['#......#', '########', '.#++++#.', '..####..'],
  mouthO: ['.##.', '#..#', '#..#', '.##.'],
  mouthFlat: ['..##..', '######'],
  mouthWave: ['.#.#.#.', '#.#.#.#'],
  mouthSmirk: ['#..##...', '.##..###'],
  mouthHmm: ['....##', '####..'],
  mouthSad: ['.####.', '#....#'],
};
const LED = { on: '#d1fae5', glow: '#34d399', dim: 'rgba(52, 211, 153, 0.5)', heart: '#ffe4e6', heartGlow: '#fb7185', blush: 'rgba(251, 113, 133, 0.85)', off: '#0e1626', screen: '#03060c' };

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
    } else if (expr === 'wow') {
      at(PAT.star, lx, ey);
      at(PAT.star, rx, ey);
      mouth = PAT.mouthO;
    } else if (expr === 'think') {
      at(PAT.eye, lx + 1, ey - 1);
      at(mirror(PAT.eye), rx + 1, ey - 1);
      mouth = PAT.mouthHmm;
    } else if (expr === 'sad') {
      at(mirror(PAT.eye), lx, ey + 0.5);
      at(PAT.eye, rx, ey + 0.5);
      mouth = PAT.mouthSad;
    } else if (expr === 'blush') {
      at(PAT.eyeHappy, lx, ey);
      at(PAT.eyeHappy, rx, ey);
      at(PAT.blush, lx - 1, ey + 3);
      at(PAT.blush, rx + 1, ey + 3);
      mouth = PAT.mouthGrin;
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
        else if (ch === 'p') { c.shadowColor = LED.heartGlow; c.shadowBlur = 10; c.fillStyle = LED.blush; }
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
   * expr, talk, nod, hop, spin (0..1, -1 none), wave, wag, sleepy, boost, burn (boosters on), scale (pop in/out), still.
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
      if (p.expr === 'surprised' || p.expr === 'wow') rx -= 0.22;
      if (p.expr === 'sad') { rx += 0.35; rz -= ear.side * 0.15; }
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
    const merry = p.wag || p.expr === 'happy' || p.expr === 'love' || p.expr === 'blush' || p.expr === 'wow';
    const wag = s * Math.sin(t / (merry ? 140 : 420)) * (merry ? 0.35 : 0.15) + st.sw * 0.8;
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
    const boosters = clamp((speed - 4) * 0.08, 0, 1) + (p.burn ? 0.8 : 0);
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
      expr: 'idle', exprUntil: 0, spinFrom: -1e9, hopFrom: -1e9, nodUntil: 0, waveUntil: 0, wagUntil: 0,
      cursor: null, cursorMovedAt: -1e9, lastInput: now, sleeping: false, sleptAt: 0,
      pokes: 0, pokeAt: 0,
    };
    this.target = null;
    this.mode = 'hero';
    this.presenting = null;       // { section, until, said } while introducing a heading
    this.entry = null;            // the flying entrance while it plays
    this.portal = null;           // 'open' while the section portal opens, 'hold' while it covers the page
    this.petting = false;         // pointer is over Max: hold still so he can be clicked
    this.hidden = true;
    this.dialogOpen = false;
    this.speaking = false;
    this.typing = false;
    this.speakingPrio = 0;
    this.lastUnprompted = -1e9;
    this.lastTalk = now;
    this.speechStart = 0;
    this.speechEnd = 0;
    this.focus = null;            // { el, until }: what Max is explaining, so he looks at it
    this.introduced = new Set();
    this.talkCooldowns = new WeakMap();
    this.reactedAt = new Map();
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
      this.entry = { start: now, dur: 1300, from: { x: vw * 0.85, y: vh + box }, c1: { x: vw * 0.1, y: vh * 0.6 }, c2: { dx: vw * 0.35, dy: vh * 0.25 } };
    } else {
      this.entry = { start: now, dur: 1700, from: { x: -box * 0.6, y: vh + box * 0.5 }, c1: { x: vw * 0.28, y: -vh * 0.05 }, c2: { dx: box * 1.1, dy: -box * 0.9 } };
    }
    this.entry.scale0 = this.target.scale * 0.55;
    s.cx = this.entry.from.x;
    s.cy = this.entry.from.y;
    s.scale = this.entry.scale0;
    s.spinFrom = now + this.entry.dur * 0.2;
    if (greet) {
      // Heart eyes from the moment he launches, and he starts saying hello mid-flight
      this.setExpr('love', this.entry.dur + 4000);
      setTimeout(() => this.greet(), this.entry.dur * 0.3);
    } else {
      this.setExpr('cool', this.entry.dur);
    }
  }

  /** Touchdown after the entrance: a little hop, a burst of sparks, then hello (heart eyes on page load). */
  arrive(now) {
    const s = this.s;
    if (!reducedMotion) s.hopFrom = now;
    this.engine.burst(20);
    if (this.greetOnArrival) {
      s.waveUntil = now + 2400;
      if (reducedMotion) this.greet();
    } else {
      s.waveUntil = now + 1600;
      this.say(pick(LINES.show, 'show'), { prio: 3 });
    }
  }

  hide() {
    this.entry = null;
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
    this.say(LINES.greet(), { prio: 2 });
    setTimeout(() => {
      if (this.portal || (this.speaking && this.speakingPrio > 2)) return;
      this.say(pick(this.compact ? LINES.greetFollow.touch : LINES.greetFollow.desktop, 'greetFollow'), { prio: 2 });
    }, reducedMotion ? 2600 : 3900);
  }

  /* ---- page wiring ---- */

  bind() {
    const markInput = () => {
      const s = this.s;
      const now = performance.now();
      if (s.sleeping) {
        s.sleeping = false;
        if (now - s.sleptAt > 5000) {
          this.say(pick(LINES.wake, 'wake'), { prio: 2 });
        }
      }
      s.lastInput = now;
    };

    // Reactions to what the visitor is doing, each with its own cooldown
    const react = (key, cooldown) => {
      const now = performance.now();
      if (this.hidden || this.portal || this.entry) return;
      if (now - (this.reactedAt.get(key) || -1e9) < cooldown) return;
      if (this.say(pick(LINES.situations[key], key), { prio: 2 })) this.reactedAt.set(key, now);
    };

    let fastMoves = 0;
    window.addEventListener('pointermove', (e) => {
      const s = this.s;
      const now = performance.now();
      if (s.cursor && e.pointerType === 'mouse') {
        // Wild cursor shaking gets a "Wheee!"
        const speed = Math.hypot(e.clientX - s.cursor.x, e.clientY - s.cursor.y) / Math.max(8, now - (s.cursorAt || now - 16)) * 1000;
        fastMoves = speed > 4000 ? fastMoves + 1 : Math.max(0, fastMoves - 1);
        if (fastMoves > 14) {
          fastMoves = 0;
          react('shake', 45000);
        }
      }
      if (!s.cursor || Math.abs(e.clientX - s.cursor.x) + Math.abs(e.clientY - s.cursor.y) > 3) s.cursorMovedAt = now;
      s.cursor = { x: e.clientX, y: e.clientY };
      s.cursorAt = now;
      markInput();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', (e) => {
      this.s.cursorMovedAt = -1e9;
      if (e.pointerType === 'mouse') react('leave', 90000);
    });

    // Speed-scrolling and reaching the very bottom
    let lastScrollY = window.scrollY;
    let lastScrollAt = performance.now();
    let fastScrolls = 0;
    let reachedBottom = false;
    window.addEventListener('scroll', () => {
      const now = performance.now();
      const speed = Math.abs(window.scrollY - lastScrollY) / Math.max(8, now - lastScrollAt) * 1000;
      lastScrollY = window.scrollY;
      lastScrollAt = now;
      fastScrolls = speed > 4500 && !this.portal ? fastScrolls + 1 : 0;
      if (fastScrolls > 5) {
        fastScrolls = 0;
        react('scrollFast', 40000);
      }
      if (!reachedBottom && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        reachedBottom = true;
        setTimeout(() => react('bottom', Infinity), 700);
      }
    }, { passive: true });

    // Selecting text
    let selectTimer = 0;
    document.addEventListener('selectionchange', () => {
      clearTimeout(selectTimer);
      selectTimer = setTimeout(() => {
        const selection = window.getSelection();
        const active = document.activeElement;
        if (selection && selection.toString().trim().length > 6 && !(active && active.matches('input, textarea'))) react('select', 45000);
      }, 700);
    });
    window.addEventListener('scroll', markInput, { passive: true });
    window.addEventListener('keydown', markInput);
    window.addEventListener('touchstart', markInput, { passive: true });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => react('resize', 60000), 500);
      const compact = this.isCompact();
      if (compact === this.compact) return;
      this.compact = compact;
      this.R = compact ? BOX.compact : BOX.desktop;
      this.layer.classList.toggle('is-compact', compact);
      this.body.style.width = this.body.style.height = `${this.R}px`;
      this.engine.setSize(this.R);
    });

    // Coming back to the tab after a while
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
        hiddenAt = performance.now();
      } else if (!this.hidden) {
        this.start();
        if (performance.now() - hiddenAt > 8000) setTimeout(() => react('welcomeBack', 60000), 500);
      }
    });

    // Pat Max: he holds still, blushes, and says hi while the pointer is on him
    this.hit.addEventListener('pointerenter', () => {
      const now = performance.now();
      // Only when the visitor moves onto Max, not when he flies under a resting cursor
      if (now - this.s.cursorMovedAt > 150) return;
      this.petting = true;
      if (now - (this.reactedAt.get('petting') || -1e9) > 9000 && this.say(pick(LINES.petting, 'petting'), { prio: 2 })) this.reactedAt.set('petting', now);
      else if (!this.speaking) this.setExpr('blush', 1400);
    });
    this.hit.addEventListener('pointerleave', () => { this.petting = false; });
    this.hit.addEventListener('click', () => this.poke());

    // Explanations: rest the pointer on something (or tap it on a touch screen) and Max tells you about it
    let hoverTimer = 0;
    let hoverEl = null;
    const explain = (match) => {
      const now = performance.now();
      if (this.hidden || this.portal || this.entry) return;
      if (now - (this.talkCooldowns.get(match.el) || -1e9) < HOVER_COOLDOWN) return;
      // Let a line that has only just started get its first words out, then explain (if still pointed at)
      if (this.speaking && this.speakingPrio >= 2 && now - this.speechStart < 1300) {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => { if (hoverEl === match.el || match.touch) explain(match); }, 1300 - (now - this.speechStart) + 50);
        return;
      }
      const source = typeof match.rule.say === 'function' ? () => match.rule.say(match.el) : match.rule.say;
      const line = resolveLine(source, `talk-${TALK.indexOf(match.rule)}`);
      if (line && this.say(line, { prio: 2 })) {
        this.talkCooldowns.set(match.el, now);
        this.focus = { el: match.el, until: this.speechEnd };
      }
    };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const match = this.matchTalk(e.target);
      if (!match || match.el === hoverEl) return;
      hoverEl = match.el;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => explain(match), HOVER_DWELL);
    });
    document.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch') return;
      const match = this.matchTalk(e.target);
      if (match) explain({ ...match, touch: true });
    });
    document.addEventListener('pointerout', (e) => {
      if (!hoverEl || (e.relatedTarget && hoverEl.contains(e.relatedTarget))) return;
      hoverEl = null;
      clearTimeout(hoverTimer);
    });

    // Section transitions: fly into the warp portal beside the title, then carry on when it collapses
    document.addEventListener('ky:portal', (e) => {
      if (this.hidden || this.compact) return;
      const { phase, label, id } = e.detail;
      if (phase === 'start') {
        this.portal = 'open';
        this.entry = null;
        this.presenting = null;
        this.focus = null;
        this.s.sleeping = false;
        this.say(pick(LINES.portal(label), 'portal'), { prio: 3, expr: 'cool' });
      } else if (phase === 'covered') {
        this.portal = 'hold';
        this.setExpr('happy', 1600);
        this.s.nodUntil = performance.now() + 700;
      } else if ((phase === 'reveal' || phase === 'end') && this.portal) {
        // Take off as the portal collapses, then introduce the section he just led you to
        this.portal = null;
        this.hideBubble();
        if (id) this.introduced.delete(id);
        this.lastUnprompted = -1e9;
      }
    });

    // Reactions to the page
    document.addEventListener('ky:filter', (e) => {
      this.say(LINES.filters[e.detail.filter] || `Showing ${e.detail.label}.`, { prio: 2, expr: 'surprised' });
    });
    document.addEventListener('ky:skill', (e) => {
      const now = performance.now();
      if (now - this.lastSkillAt < SKILL_COOLDOWN) return;
      const line = SKILL_TAB_TALK[e.detail.id];
      if (line && this.say(line, { prio: 2 })) this.lastSkillAt = now;
    });
    document.addEventListener('ky:copy-email', () => {
      this.say(pick(LINES.copied, 'copied'), { prio: 2 });
    });
    document.addEventListener('ky:themechange', (e) => {
      this.engine.applyTheme();
      const light = e.detail && e.detail.theme === 'light';
      this.say(pick(light ? LINES.themeLight : LINES.themeDark, 'theme'), { prio: 2 });
    });
    document.addEventListener('ky:dialog', () => {
      this.dialogOpen = !!document.querySelector('dialog[open]');
      if (this.dialogOpen) this.hideBubble();
    });
  }

  /** The first explanation rule that matches the element under the pointer (or one of its ancestors). */
  matchTalk(node) {
    if (!(node instanceof Element) || this.layer.contains(node)) return null;
    for (const rule of TALK) {
      const el = node.closest(rule.sel);
      if (el && (!rule.text || rule.text.test(el.textContent))) return { el, rule };
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
      this.say(pick(LINES.dizzy, 'dizzy'), { prio: 2, exprMs: 2200 });
    } else {
      this.say(pick(LINES.poke, 'poke'), { prio: 2 });
    }
  }

  /* ---- speech and expressions ---- */

  setExpr(expr, ms) {
    this.s.expr = expr;
    this.s.exprUntil = performance.now() + ms;
  }

  /** Little body-language moves that punctuate what Max says. */
  gesture(name) {
    if (reducedMotion) return;
    const s = this.s;
    const now = performance.now();
    if (name === 'nod') s.nodUntil = now + 700;
    else if (name === 'hop') s.hopFrom = now;
    else if (name === 'spin') s.spinFrom = now;
    else if (name === 'wave') s.waveUntil = now + 1800;
    else if (name === 'wag') s.wagUntil = now + 2200;
  }

  /**
   * Show a speech bubble. `line` is a string or a list of parts { t, e, g }; as the typing reaches each
   * part, Max switches to its expression and plays its gesture, so he reacts while he talks.
   * prio 1 = unprompted (chatter, sections), 2 = explanations and reactions, 3 = show/hide/portal.
   * Returns false when the line was skipped (cooldown, a more important line is playing, or hidden).
   */
  say(line, { prio = 1, expr = 'happy', exprMs, then } = {}) {
    if (!line) return false;
    const parts = typeof line === 'string' ? [{ t: line }] : line;
    const text = parts.map((part) => part.t).join('');
    if (this.hidden && prio < 3) return false;
    if (this.dialogOpen) return false;
    if (this.portal && prio < 3) return false;
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
    this.speechStart = now;
    const hold = clamp(text.length * 45, 2400, 6000);
    this.speechEnd = now + (reducedMotion ? 0 : text.length * 24) + hold;
    // Reaction cues at the character where each part starts
    let at = 0;
    const cues = parts.map((part) => {
      const cue = { at, e: part.e || expr, g: part.g };
      at += part.t.length;
      return cue;
    });
    const react = (cue) => {
      this.setExpr(cue.e, 60000);
      if (cue.g) this.gesture(cue.g);
    };
    react(cues[0]);
    let nextCue = 1;
    if (exprMs) this.setExpr(cues[0].e, exprMs);
    if (then) this.exprTimer = setTimeout(() => this.setExpr(then, hold), exprMs || 900);

    // Measure the full line first so the bubble does not resize while typing
    this.bubble.style.width = '';
    this.bubbleText.textContent = text;
    this.bubbleW = this.bubble.offsetWidth;
    this.bubbleH = this.bubble.offsetHeight;
    this.bubble.style.width = `${this.bubbleW}px`;
    this.bubble.classList.add('is-visible');

    const finish = () => {
      this.typing = false;
      // Keep the last reaction on his face while the bubble stays up
      if (!exprMs && !then) this.s.exprUntil = performance.now() + hold + 300;
      this.hideTimer = setTimeout(() => this.hideBubble(), hold);
    };
    if (reducedMotion) {
      if (cues.length > 1) this.setExpr(cues[cues.length - 1].e, 60000);
      finish();
      return true;
    }
    this.bubbleText.textContent = '';
    this.typing = true;
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 1;
      this.bubbleText.textContent = text.slice(0, i);
      while (nextCue < cues.length && i > cues[nextCue].at) {
        react(cues[nextCue]);
        nextCue += 1;
      }
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
   * Where Max should fly right now, in priority order: flying into the section portal, introducing a new
   * section heading, following the moving cursor, hovering by the hero terminal, napping in the
   * corner, or perching at the nearest screen edge while you read.
   */
  computeTarget(now) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const R = this.R;
    const s = this.s;

    if (this.portal) {
      // Warp portal: hover low beside the big title, looking at it
      return { mode: 'warp', scale: 0.8, cx: vw / 2 + Math.min(vw * 0.32, 440), cy: vh * 0.62, lookAt: { left: vw / 2 - 1, width: 2, top: vh * 0.45 } };
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
    const explaining = this.focus && now < this.focus.until;
    if (cursorInPage && !s.sleeping && (this.petting || explaining || now - s.cursorMovedAt < FOLLOW_IDLE)) {
      const scale = 0.8;
      if (this.petting) return { mode: 'follow', scale, cx: s.cx, cy: s.cy };
      const box = R * scale;
      const gap = box * 0.3 + 52;
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

    if (!this.target || this.portal || this.frame % 2 === 0) this.target = this.computeTarget(now);
    const tg = this.target;
    this.mode = tg.mode;

    // Fly: a soft spring (looser while following the cursor, snappier into the portal)
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
      const k = tg.mode === 'follow' ? 12 : tg.mode === 'warp' ? 26 : 18;
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
    if (!s.sleeping && idleFor > SLEEP_AFTER && !this.speaking && !this.portal && !this.presenting) {
      s.sleeping = true;
      s.sleptAt = now;
    }
    // Small talk when it has been quiet for a while, but only while someone is around to hear it
    if (!s.sleeping && !this.speaking && !this.portal && !this.entry && !this.presenting
      && now - Math.max(this.lastTalk, this.speechEnd) > IDLE_CHAT_AFTER && now - s.lastInput < 30000) {
      this.say(resolveLine(LINES.chatter, 'chatter'), { prio: 1 });
      this.lastTalk = now;
    }

    // Gaze: body and eyes turn towards the cursor; towards the heading while presenting
    const head = this.engine.headOnPage(s.cx, s.cy, box);
    let lookX = 0;
    let lookY = 0;
    if (this.entry) {
      lookX = clamp(s.vx / 900, -1, 1);
      lookY = clamp(s.vy / 1200, -1, 1);
    } else if (tg.lookAt) {
      lookX = clamp((tg.lookAt.left + tg.lookAt.width / 2 - head.x) / (vw * 0.3), -1, 1);
      lookY = clamp((tg.lookAt.top - head.y) / (vh * 0.35), -1, 1);
    } else if (this.focus && now < this.focus.until && this.focus.el.isConnected) {
      // Looking at whatever he is explaining
      const r = this.focus.el.getBoundingClientRect();
      lookX = clamp((r.left + r.width / 2 - head.x) / (vw * 0.25), -1, 1);
      lookY = clamp((r.top + r.height / 2 - head.y) / (vh * 0.3), -1, 1);
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
      wag: now < s.wagUntil,
      hop: hopP <= 1 ? hopP : -1,
      spin: spinP <= 1 ? spinP : -1,
      sleepy: s.sleeping,
      boost: this.entry ? 2.2 : this.portal === 'open' ? 1.7 : 1,
      burn: this.portal === 'open',
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
    const preferRight = cursorLeft || !this.s.cursor || this.compact || !!this.portal; // in the portal, keep the title clear
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
  // Build Max while the intro plays, so he flies in (with heart eyes) the moment the page is ready
  const building = ensureMax();
  whenPageReady()
    .then(() => building)
    .then((m) => { if (m && !hidden) m.show({ greet: true }); });
})();
