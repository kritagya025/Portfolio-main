# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.5.0] - 2026-10-20

### Added
- Experience section (03) for the Software Engineering & QA internship at Compass (HeyCompass), taken from the resume: role, dates, key numbers, five highlights, and skills used; added to the navbar, mobile menu, `Ctrl+K` palette, section curtain, and sitemap (later sections renumbered 04–08)
- Resume details the site was missing: React (basic), optimistic and pessimistic locking, MockMvc, manual and exploratory testing, Claude Code; Event Booking pessimistic locking, multithreaded overbooking test, per-resource ownership checks, and 6-test security regression suite; LinkPulse 39 JUnit/Mockito tests, live-database CI tests before each deploy, and a 3-stage Docker build with a jlink-pruned, non-root runtime; "(Expected)" graduation date; the internship in About and the structured data

### Changed
- Max is the reference robot again ("Flying Robot 07", CC BY 4.0) with a new LED dot-matrix **wolf face**: pointed ears, slanted eyes, fur tufts, and a snout, with blinks, ear flicks, and expressions (happy, surprised, cool shades, dizzy, sleepy, wink)
- Heart eyes when Max greets you on page load (and when you hover Hire Me, Copy email, or the resume)
- Thruster flames, wobbling antennas, and swinging cables as in the reference; Max still follows the cursor and turns his body and eyes towards it, and perches at the nearest screen edge while you read instead of covering content; he ignores the cursor while it is over the navbar
- Navbar logo: a solid "KY" monogram in a gradient-ringed tile with a "Kritagya." wordmark (hidden at 1024–1279px so the navbar fits); the old 20px gradient "KY" was clipped and hard to see
- Test counts aligned with the resume: 45+ tests overall (39 LinkPulse JUnit/Mockito tests + the 6-test security suite), LinkPulse 39 (was 16), Event Booking now shows its 6-test security regression suite
- Spelling: American English throughout ("modeling", "practiced"), "Cheat sheet", "roll back", and "BCrypt Password Hashing" (BCrypt hashes; it does not encrypt)

### Removed
- The wolf model (`assets/models/max-wolf.glb`)

---

## [3.4.0] - 2026-10-20

### Changed
- New colour theme: monochromatic dark slate (`#0F172A`) with neon emerald and purple highlights (light theme retuned to match); buttons use dark text on emerald; favicon, 404 page, web manifest, GitHub stat cards, and theme-color updated
- Max is now a **flying mech-wolf**: chrome armour with environment reflections, glowing emerald circuit lines skinned to his skeleton, emerald eyes, a two-thruster jetpack with flames that stretch with speed, a purple-tipped antenna, and an anti-gravity glow; he hovers and banks instead of walking
- Max follows the cursor while it moves (and holds still when you move onto him so he can be patted), and his head bone now tracks the cursor
- Max flies to each new section heading to introduce it, then returns to following you; he hovers by the hero terminal when the cursor is at rest
- Section transitions are slower and easier to read: 1.1 s slide-in, 0.75 s hold on the section name, 0.95 s wipe-out
- Location updated to Noida, India

---

## [3.3.0] - 2026-10-20

### Changed
- Max is now a **wolf**: the rigged, animated "Wolf" by Quaternius (CC0) replaces the robot model (`assets/models/max-wolf.glb`, trimmed to 9 clips and meshopt-compressed, 313 KB), recoloured to the site palette with glowing eyes
- Movement uses real gaits: idle, walk, and gallop chosen from his speed, facing the direction of travel, with a ground shadow; a three-quarter view towards the cursor while standing
- Max stands on ledges: the top of the hero terminal, the line beside each section label, and the top edge of the active project card; he gallops ahead of the section curtain
- Reactions are animations: hit-react on pats, a hop on copy-email and when the curtain lands, a look-around on filters/theme changes and as an occasional fidget, and a head-down nap with floating "zzz" when idle
- On phones and windows narrower than 1024px Max rides in the empty middle of the navbar and never intercepts taps
- Paw icon for the show/hide button; lines rewritten for a wolf; footer and README credits updated

### Removed
- The robot model (`assets/models/max-robot.glb`) and its LED-face renderer

---

## [3.2.0] - 2026-10-20

### Added
- Section transitions: navbar, logo, mobile-menu, and `Ctrl+K` section jumps slide a full-screen curtain in with the section number and name, move the page while it is covered, then wipe it away (instant jump for reduced-motion users)
- Max tows the curtain in from the right, waits at the edge while the page changes, then flies to the new section and introduces it
- Credits for Max's model ("Flying Robot 07" by Konstantin_Dem, CC BY 4.0) in the footer and README

### Changed
- The robot guide is now **Max**: the procedural model is replaced by the "Flying Robot 07" glTF model (`assets/models/max-robot.glb`, Draco-compressed) with the LED face projected onto its screen; module renamed to `js/max-bot.js`
- Max uses the small corner dock (beside the robot button) on touch devices and windows narrower than 1024px

### Removed
- `js/bean-bot.js` (superseded by `js/max-bot.js`)

---

## [3.1.0] - 2026-10-20

### Added
- Bean, a floating three.js robot guide (`js/bean-bot.js`): LED-matrix face, cursor-following eyes, flies between the hero, section headings, and a corner dock; contextual speech bubbles; reactions to filters, skill tabs, theme, copy email, and pokes; persistent show/hide toggle; lazy-loaded, WebGL-gated, reduced-motion aware
- Native code-only language breakdown card (bytes per language across public non-fork repos, excluding HTML/CSS markup and notebooks), refreshed from the GitHub API with a 24-hour cache and bundled snapshot fallback
- Direct KeyVault repository link

### Changed
- Replaced the third-party "Most Used Languages" image (which counted HTML/CSS bytes and under-represented Java) with the native language breakdown

### Fixed
- Pinned project showcase: filtered-out cards are now actually hidden, and the frame can no longer be scrolled sideways by focus (keyboard focus on an off-screen card slides it into view)

---

## [3.0.0] - 2026-10-20

### Added
- Complete visual redesign: HSL design-token system (violet / magenta / teal), Space Grotesk + Syne + JetBrains Mono typography, numbered section eyebrows, oversized outlined background words, glass cards, and grid overlays
- Light theme with a persistent toggle (navbar, mobile, and `Ctrl+K` palette), applied before first paint
- Cinematic hero: letter-by-letter name reveal, rotating role badge, count-up stats (83+ REST APIs, 55+ tests, 7.58 CGPA), side social rail, scroll parallax, and a decorative terminal card on wide screens
- Dedicated About section with bio, focus areas, stat cards, and an `@Version` code snippet
- Interactive skills explorer: accessible tab list with arrow-key navigation and animated tool tiles (stacked cards on mobile)
- Pinned horizontal project showcase on desktop with a progress rail; filters recalculate the showcase length
- Project detail modals with key metrics, highlights, tech stack, and links
- Direct repository links for Event Booking System and LinkPulse, plus the LinkPulse live demo and LeetCode profile (sourced from the resume)
- Contact bento grid (location + live IST time, LinkedIn, GitHub, LeetCode, phone) and a roles marquee
- Time-based preloader with progress ring and circular reveal

### Changed
- All overlays (command palette, shortcuts, architecture deep dive, project details, mobile menu) now use native `<dialog>` elements for focus trapping, `Esc` handling, and focus restoration
- In-page navigation smoothly scrolls via Lenis and moves keyboard focus to the target section
- Mobile navigation is now a full-screen menu
- Education and certifications merged into a single "Journey" bento section (`#education` and `#certifications` anchors preserved)
- GitHub streak card moved to the official `streak-stats.demolab.com` host; stat cards show a fallback link if an image service is down
- Particle constellation and ambient orbs now follow the active theme colour
- 404 page, web manifest, and favicon restyled to the new palette
- Updated sitemap.xml `lastmod` timestamps to 2026-10-20

### Removed
- `content-visibility` hints on below-fold sections (they made anchor targets land in the wrong place before first render)

---

## [2.4.0] - 2026-10-08

### Added
- Interactive Project Filter system with animated category pills (All, High Concurrency, Cloud & DevOps, Security & APIs) and dynamic item counts
- System Architecture Deep Dive interactive modal for featured high-concurrency Event Booking System project (flow lifecycle diagram, concurrency control, Redis TTL locks, STOMP WebSockets, dual-token JWT)
- Live hiring availability status pill ("Available for Backend Roles & Internships") with pulsing indicator
- Real-time IST (UTC+5:30) local time widget with automated minute ticker in Hero section
- Direct architecture modal trigger and project filter commands in `Ctrl+K` Command Palette

### Changed
- Enhanced Bento Grid layout to gracefully handle filtered single-item views with responsive full-width spans
- Updated `Escape` key shortcut controller to dismiss both Architecture modal and Shortcuts modal
- Updated sitemap.xml `lastmod` timestamps to 2026-10-08
- Bumped version to v2.4.0

---

## [2.3.0] - 2026-10-07

### Added
- "Currently Exploring" section highlighting ongoing technical upskilling (Microservices, Kafka, Kubernetes)
- One-click copy email button with floating glass toast notification feedback
- Interactive Keyboard Shortcuts modal with `?` trigger and visual cheatsheet
- Web App Manifest (`site.webmanifest`) for PWA installation support
- Visual `Ctrl+K` shortcut indicator badge in desktop navigation bar
- ARIA live region (`aria-live="polite"`, `role="status"`) on role typing animation for assistive technology
- Page Visibility API integration to pause particle canvas loop when browser tab is inactive

### Changed
- Integrated "Currently Exploring", "Copy Email", and "Keyboard Shortcuts" into Ctrl+K Command Palette
- Updated sitemap.xml to include `#learning` section URL and refreshed lastmod dates
- Bumped version to v2.3.0

---

## [2.2.0] - 2026-10-04

### Added
- Custom 404 error page matching portfolio's dark design aesthetic
- `.gitignore` for OS, editor, and build artifact exclusions
- Print-friendly stylesheet with ink-optimized layout
- `noscript` fallback for JavaScript-disabled browsers
- `aria-label` attributes on footer social links
- Open Graph URL and image meta tags for richer social previews
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- This `CHANGELOG.md` file

### Changed
- Updated sitemap `lastmod` dates
- Bumped portfolio version from 2.1.0 to 2.2.0

---

## [2.1.0] - 2026-09-29

### Added
- Developer console Easter egg with ASCII art
- Hash-based navigation error recovery
- Particle constellation interactive background effect
- Cinematic page entrance preloader with KY monogram

### Changed
- Repositioned back-to-top button in DOM structure
- Hidden Jupyter Notebook from top languages stats card

---

## [2.0.0] - 2026-09-28

### Added
- Sitemap.xml for search engine discoverability
- Dynamic copyright year auto-update in footer
- GitHub contribution stats and coding activity section
- Scroll progress indicator bar
- Animated typing effect on hero subtitle
- Active nav link highlighting on scroll
- Structured JSON-LD schema markup for SEO
- Resource preloading hints for critical fonts
- Lazy decoding, `will-change` hints, and CSS containment

### Improved
- Keyboard navigation focus styles and `prefers-reduced-motion` support

---

## [1.0.0] - 2026-09-27

### Added
- Initial portfolio release
- Glassmorphism dark-mode design
- Bento Grid project layout
- Hero section with GSAP animations
- Skills, Education, Certifications, Contact sections
- Responsive mobile navigation drawer
- Lenis smooth scrolling
- AOS reveal animations
- Vanilla-Tilt 3D card effects
- CONTRIBUTING.md, SECURITY.md, LICENSE (MIT), README.md
