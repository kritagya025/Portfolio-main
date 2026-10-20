# 🚀 Kritagya Yadav — Personal Portfolio

[![Java](https://img.shields.io/badge/Java-21-orange.svg?style=for-the-badge&logo=openjdk)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.x-emerald.svg?style=for-the-badge&logo=springboot)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Cache-red.svg?style=for-the-badge&logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-cyan.svg?style=for-the-badge&logo=docker)](https://www.docker.com/)

A modern, high-performance personal developer portfolio showcasing software engineering projects, backend architecture experience, technical skills, education, and credentials. Built around a monochromatic dark design system — a dark slate (`#0F172A`) canvas with neon emerald and purple highlights, oversized display typography, glass cards, numbered sections, a pinned horizontal project showcase, and optimized SEO metadata.

---

## 📑 Table of Contents

- [Features & User Experience](#-features--user-experience)
- [Technical Stack](#️-technical-stack)
- [Featured Backend Systems](#-featured-backend-systems)
- [Local Preview & Setup](#-local-preview--setup)
- [Contact & Connect](#-contact--connect)

---

## ✨ Features & User Experience

- **🎨 Design System with Light & Dark Themes**: HSL design tokens (`--primary`, `--accent`, `--neon`, …) drive both themes; the toggle is remembered per visitor and applied before first paint. Switching themes reveals the new one in a circle that grows from the toggle you pressed while the old view dims (View Transitions; other browsers cross-fade the colors). Film grain, grid overlays, glass cards, and huge outlined section words give every section depth.
- **🖥️ System-Boot Intro**: The page opens like a machine booting up: a KY monogram draws itself inside a ring that fills with the real loading progress, the name decodes out of scrambled glyphs, a terminal boot log types facts from the site (stack, 83+ endpoints, 45+ tests, Bella waking up), and at "ACCESS GRANTED" a glowing seam splits the screen and the doors part as the emblem flies toward you. Full version once per visit, a short one on reloads; click or press any key to skip.
- **🎬 Cinematic Hero**: Letter-by-letter name reveal (GSAP), rotating role badge, live stats (83+ REST APIs · 45+ automated tests · 7.58 CGPA), side social rail, scroll-linked parallax, and a decorative terminal card on wide screens.
- **🟢 Live Availability & Local Time**: Real-time hiring availability badge paired with dynamic Indian Standard Time (IST &middot; UTC+5:30) clock widget in the Hero and Contact sections.
- **🗂️ Pinned Horizontal Project Showcase**: On desktop, featured projects scroll sideways inside a pinned viewport with a progress rail; tablets and phones get stacked cards. Category filters (*All*, *High Concurrency*, *Cloud & DevOps*, *Security & APIs*) keep their live counts.
- **🔎 Project Detail Modals**: Each card opens a detail view with key metrics, highlights, tech stack, and source/live links.
- **💼 Experience**: The Software Engineering & QA internship at Compass (HeyCompass) with dates, key numbers (50 merged commits, 25+ QA-reported defects), and highlights taken from the resume.
- **🤖 Bella, the Hovering Robo-Wolf**: An original robot built entirely in code with three.js (`js/bella-bot.js`, no model files): a helmet head with metal wolf ears and a curved LED visor showing a wolf face, a floating neck ring, a two-tone armored body with glowing vents and a pulsing reactor core, paw hands, a segmented tail, a hover thruster that sheds sparks, twin back boosters that fire at speed, and a holographic orbit ring. Bella has an outfit per theme (pearl white with gunmetal armor and neon lights on dark pages; glossy midnight indigo with silver armor, violet and emerald lights on light pages) and changes outfits with a glowing scanner ring that sweeps from ear tips to thruster while the colors morph. Bella makes a flying entrance (launching from below the screen, swooping across it with a barrel roll, and touching down in a burst of sparks), then greets you with heart eyes and a wave. Bella flies alongside your cursor and turns to look at it, flies to each section heading as it scrolls in to introduce it, hovers by the hero terminal, flies into the section-transition portal, perches at the screen edge while you read, and reacts to project filters, skill tabs, theme changes, copied email, and pokes (blinks, ear flicks, tail wags, and a nap with floating "zzz" when you go idle). Bella is chatty: rest the cursor on almost anything (every skill, number, project, internship highlight, link, and button) or tap it on a phone, and Bella explains it, changing expression mid-sentence (star eyes, thinking, cool shades, a blush, a sad face) with nods, hops, spins, waves, and tail wags; Bella also notices speed-scrolling, text selection, cursor shaking, coming back to the tab, and reaching the end of the page, and makes small talk with tips and facts when it is quiet. On phones and narrow windows Bella hovers in the navbar and never covers content (tap the robot there to poke it, tap a speech bubble to dismiss it). Bella adapts to each device: a lighter build (fewer polygons and sparks, no antialiasing, capped pixel ratio) on phones, tablets, and weaker hardware; 30 fps on phones and tablets and 20 fps while napping to save battery; automatic resolution drop if frames run slow; a size that fits short laptop screens and large monitors; no download at all on data-saver or 2G connections until you ask; and keyboard users get the same explanations when they Tab to something. The robot button (bottom-left) hides/shows Bella and the choice is remembered; hiding is a little heartbreaking: Bella tears up when you hover the button, and when you press it, sobs with LED tears streaming down the visor and drops falling from it, wipes the visor with both paws, waves goodbye, and shrinks away. Built while the intro plays, skipped without WebGL, and still for reduced-motion users.
- **🌀 Warp Portal Transitions**: Jumping to a section (navbar, logo, mobile menu, or `Ctrl+K`) opens a glowing portal that bursts out from the link you clicked. Inside, a terminal types the route (`cd ./skills`), the section number and title come into focus over an LED dot field with orbiting rings, and a loader fills to `200 OK`. The page moves while it is covered, then the title glitches and the portal collapses into the center. Reduced-motion users get an instant jump.
- **📊 Code-Only Language Breakdown**: A native card that sums bytes per language across public, non-fork repositories (excluding HTML/CSS markup and notebooks), refreshed live from the GitHub API with a day-long cache and a bundled snapshot fallback.
- **🏛️ System Architecture Deep Dive**: Interactive architecture modal detailing the Event Booking Engine's high-concurrency lifecycle, `@Version` optimistic locking, Redis TTL locks, and STOMP WebSocket broadcasting.
- **🧭 Interactive Skills Explorer**: Eight skill categories in an accessible tab list (arrow-key navigation) with animated tool tiles; stacked cards on mobile.
- **⌘ Command Palette & Shortcuts**: Fast navigation with `Ctrl+K` quick switcher (sections, project filters, architecture deep dive, theme toggle, copy email, resume) and `?` keyboard shortcuts cheat sheet.
- **📋 One-Click Copy & Toast**: Instant email copying to clipboard with floating animated glass toast feedback.
- **♿ Accessible Dialogs**: All overlays use native `<dialog>` elements for focus trapping, `Esc` handling, and focus restoration.
- **⚡ Interactive Micro-Animations**:
  - Smooth inertia scroll powered by [Lenis](https://lenis.darkroom.engineering/)
  - Reveal animations via [AOS (Animate On Scroll)](https://michalsnik.github.io/aos/)
  - Physics-based tilt cards with glare effects via [Vanilla-Tilt.js](https://micku7.github.io/vanilla-tilt.js/) (fine pointers only)
  - Infinite skill badge marquees with dual scroll directions
  - Page Visibility API optimization pausing background particles when inactive
- **📱 PWA & Mobile Ready**: Web App Manifest (`site.webmanifest`) for standalone home-screen installation, full-screen mobile menu, and mobile status bar theming.
- **🔍 SEO & Social Card Ready**: Complete Open Graph, Twitter Cards, resource preconnects, and custom inline SVG branding favicon.
- **🚀 Performance Optimized**: Resource hints, content-visibility containment, asynchronous script hydration, and lightweight vector assets.

---

## 🛠️ Technical Stack

- **Core Technologies**: HTML5, Vanilla JavaScript (ES6+), CSS3
- **CSS Utility Engine**: Tailwind CSS
- **Design System & Typography**: Google Fonts (*Space Grotesk* display, *Syne* body, *JetBrains Mono* labels) & FontAwesome 6
- **Animation & Physics Libraries**: GSAP, AOS, Lenis Scroll, Vanilla-Tilt.js
- **3D**: three.js (r160, ES module via import map) with RoomEnvironment reflections; Bella is modeled from three.js primitives and the wolf face is a canvas texture drawn at runtime

---

## 📂 Featured Backend Systems

1. **[Event Booking System](https://github.com/kritagya025/Event-Booking-System)**
   - Concurrency-safe booking platform with seat, payment, and ticketing workflows: 83 REST endpoints across 16 controllers and 13 JPA entities.
   - Pessimistic and optimistic locking (`@Version`) against concurrent overbooking, verified by a multithreaded test; real-time seat updates over WebSocket/STOMP; JWT, rotating refresh tokens, RBAC, and per-resource ownership checks backed by a 6-test security regression suite.

2. **[LinkPulse – URL Shortener Platform](https://github.com/kritagya025/URL_SHORTNER-LinkPluse-)** · [Live Demo](https://linkpulse-frontend.onrender.com/)
   - Production Spring Boot service on Render: GitHub Actions runs the tests against a live database before each deploy, and the app ships in a 3-stage Docker build with a jlink-pruned, non-root Java runtime.
   - 5-endpoint REST API with indexed lookups and database-enforced, collision-safe short codes, validated by 39 JUnit/Mockito tests.

3. **[KeyVault](https://github.com/kritagya025/KeyVault)**
   - Focused Spring Boot service for key and credential management with a Controller-Service-Repository architecture and server-side validation.

---

## 💼 Experience

- **Software Engineering & QA Intern — Compass (HeyCompass)**, AI travel-planning startup · 30 Aug 2026 – 7 Oct 2026
  - 50 merged commits addressing 25+ QA-reported defects with Claude as an AI coding assistant.
  - Helped resolve a race condition that let a 500-request burst bypass the API rate limit of 10 across 30 routes (atomic database update, verified by concurrency tests).

---

## 🌐 Browser Compatibility

Tested and optimized for modern evergreen browsers including Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari, and Brave.

---

## 💻 Local Preview & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kritagya025/Portfolio-main.git
   cd Portfolio-main
   ```

2. **Launch locally**:
   - Open `index.html` directly in any modern browser, or
   - Use VS Code [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) / Python HTTP server:
     ```bash
     python -m http.server 8000
     ```
   - Navigate to `http://localhost:8000`.
   - Use a local server rather than opening the file directly if you want to see Bella, the robot guide: browsers block ES modules on `file://` URLs (the rest of the site works either way).

---

## 📬 Contact & Connect

- **LinkedIn**: [Kritagya Yadav](https://www.linkedin.com/in/kritagya-yadav/)
- **GitHub**: [@kritagya025](https://github.com/kritagya025)
- **LeetCode**: [Kritagya028](https://leetcode.com/u/Kritagya028)
- **Email**: [kritagyay2006@gmail.com](mailto:kritagyay2006@gmail.com)

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

## 🏗️ Project Architecture & File Structure

```
Portfolio-main/
├── index.html              # Single-page application (all HTML, CSS, JS)
├── js/bella-bot.js         # Bella, the hovering 3D robo-wolf guide, modeled in code (lazy-loaded ES module)
├── 404.html                # Custom GitHub Pages 404 error page
├── Kritagya_Yadav_Resume.pdf  # Downloadable resume asset
├── robots.txt              # SEO crawler directives
├── sitemap.xml             # XML sitemap for search engines
├── site.webmanifest        # Web App Manifest for PWA installation
├── .editorconfig           # Editor formatting consistency rules
├── .gitattributes          # Git line-ending normalization
├── .gitignore              # OS, editor, and build artifact exclusions
├── CHANGELOG.md            # Version history (Keep a Changelog format)
├── CODE_OF_CONDUCT.md      # Contributor Covenant v2.1
├── CONTRIBUTING.md         # Contribution guidelines
├── SECURITY.md             # Security vulnerability disclosure policy
├── LICENSE                 # MIT License
└── README.md               # This file
```

### Key Architectural Decisions

| Decision | Rationale |
|---|---|
| **Single HTML file** | Zero build step, instant deployment via GitHub Pages, no framework overhead (the optional robot guide, Bella, lives in one lazy-loaded module) |
| **CDN-loaded libraries** | Avoids `node_modules` bloat; leverages browser caching from shared CDNs |
| **JSON-LD structured data** | Improves search engine rich snippet rendering (Person schema) |
| **Intersection Observer** | Efficient scroll-based nav highlighting without costly scroll listeners |
| **HSL design tokens** | One set of CSS variables powers Tailwind colors, both themes, and the particle canvas |
| **Native `<dialog>`** | Built-in focus trapping, `Esc` handling, and focus restoration for every overlay |
| **`prefers-reduced-motion`** | WCAG 2.1 AA compliance: disables smooth scroll, pinning, parallax, and reveal animations |

---

## ⚡ Performance Optimizations

- **Critical font preloading** via `<link rel="preload">` to eliminate render-blocking
- **DNS prefetching** for all CDN origins (`fonts.googleapis.com`, `unpkg.com`, `cdnjs.cloudflare.com`)
- **Lazy loading** with `loading="lazy"` and `decoding="async"` on below-fold images
- **rAF-throttled scroll handling** — one batched update per frame drives the navbar, progress bar, parallax, and pinned showcase
- **`will-change`** hints on animated elements for GPU layer promotion
- **Smooth scroll** via Lenis with custom easing for 60fps inertia scrolling

---

## 🚀 Deployment

This portfolio is designed for **GitHub Pages** deployment:

1. Push to the `main` branch
2. Go to **Settings → Pages → Source → Deploy from branch**
3. Select `main` / `/ (root)` and save
4. Site will be live at `https://<username>.github.io/Portfolio-main/`

Alternatively, deploy to any static hosting provider (Netlify, Vercel, Cloudflare Pages) by pointing to the repository root.

---

*Designed & Maintained by Kritagya Yadav.*
> Last updated: 2026-10-20


