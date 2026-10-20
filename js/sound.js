/**
 * Sound effects for Kritagya Yadav's portfolio, synthesized with the Web Audio API (no audio files).
 *
 * - Off by default. The speaker buttons (navbar, intro) and the Ctrl+K palette turn it on or off, and
 *   the choice is remembered.
 * - Browsers only allow audio after a click, tap, or key press, so nothing plays until then; sounds
 *   requested earlier are skipped rather than queued.
 * - window.KYSound: play(name), voice(mood) for Bella's babble, drone.start/level/stop for the intro
 *   hum, toggle()/setEnabled(), and a 'ky:soundchange' event.
 */
(function () {
  'use strict';

  const KEY = 'ky-sound';
  let enabled = false;
  try { enabled = localStorage.getItem(KEY) === 'on'; } catch (e) { /* storage unavailable */ }

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const lastPlayed = new Map();

  function audio() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.3;
      const limiter = ctx.createDynamicsCompressor();
      master.connect(limiter);
      limiter.connect(ctx.destination);
      ctx.onstatechange = () => syncButtons();
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // The first click, tap, or key press unlocks audio (only matters once sound is on). Remember whether
  // audio was already running, so a click on a speaker button that only unlocked it does not mute it.
  let lockedAtGesture = true;
  const unlock = () => {
    lockedAtGesture = !ctx || ctx.state !== 'running';
    if (enabled) audio();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));

  function ready() {
    if (!enabled) return null;
    const c = audio();
    return c && c.state === 'running' ? c : null;
  }

  /* ---- building blocks ---- */

  function tone({ type = 'sine', freq = 440, to, dur = 0.15, gain = 0.2, attack = 0.005, delay = 0, filter }) {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.freq;
      f.Q.value = filter.q || 0.8;
      osc.connect(f);
      node = f;
    }
    node.connect(amp);
    amp.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.3, gain = 0.15, attack = 0.02, delay = 0, type = 'bandpass', from = 800, to = 3000, q = 1 }) {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(amp);
    amp.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ---- the sound library ---- */

  const notes = (freqs, { type = 'triangle', gap = 0.07, dur = 0.24, gain = 0.14 } = {}) => {
    freqs.forEach((freq, i) => tone({ type, freq, dur, gain, delay: i * gap }));
  };

  const SOUNDS = {
    // Intro and interface
    tick: () => tone({ type: 'square', freq: 1900, to: 1300, dur: 0.03, gain: 0.04, filter: { freq: 3500 } }),
    check: () => { tone({ type: 'sine', freq: 1046, dur: 0.07, gain: 0.1 }); tone({ type: 'sine', freq: 1568, dur: 0.1, gain: 0.1, delay: 0.06 }); },
    granted: () => { notes([523, 659, 784, 1046]); tone({ type: 'sine', freq: 2093, dur: 0.6, gain: 0.06, delay: 0.3 }); },
    glitch: () => { noise({ dur: 0.14, gain: 0.12, type: 'bandpass', from: 2400, to: 6000, q: 2 }); tone({ type: 'square', freq: 220, to: 90, dur: 0.12, gain: 0.05 }); },
    doors: () => { noise({ dur: 0.9, gain: 0.2, attack: 0.25, type: 'lowpass', from: 300, to: 2600 }); tone({ type: 'sine', freq: 110, to: 40, dur: 0.45, gain: 0.35 }); },
    warp: () => { tone({ type: 'sawtooth', freq: 110, to: 880, dur: 0.75, gain: 0.05, attack: 0.2, filter: { freq: 1400 } }); noise({ dur: 0.8, gain: 0.08, attack: 0.3, type: 'highpass', from: 800, to: 5000 }); },
    on: () => notes([660, 990], { type: 'sine', gap: 0.08, dur: 0.16, gain: 0.12 }),
    portalOpen: () => { tone({ type: 'sawtooth', freq: 90, to: 520, dur: 0.9, gain: 0.05, attack: 0.25, filter: { freq: 1200 } }); noise({ dur: 0.9, gain: 0.12, attack: 0.3, type: 'bandpass', from: 400, to: 3200, q: 0.7 }); },
    portalClose: () => { noise({ dur: 0.75, gain: 0.12, attack: 0.05, type: 'bandpass', from: 3200, to: 300, q: 0.7 }); tone({ type: 'sine', freq: 140, to: 50, dur: 0.4, gain: 0.25, delay: 0.55 }); },
    themeLight: () => notes([784, 988, 1175, 1568], { type: 'sine', gap: 0.06, dur: 0.3, gain: 0.08 }),
    themeDark: () => notes([1175, 988, 784, 587], { type: 'sine', gap: 0.06, dur: 0.3, gain: 0.08 }),

    // Bella
    jet: () => { noise({ dur: 1.4, gain: 0.16, attack: 0.15, type: 'bandpass', from: 500, to: 1800, q: 0.6 }); tone({ type: 'sawtooth', freq: 70, to: 160, dur: 1.2, gain: 0.04, attack: 0.2, filter: { freq: 500 } }); },
    land: () => { tone({ type: 'sine', freq: 160, to: 60, dur: 0.3, gain: 0.3 }); notes([2093, 2637, 3136], { type: 'sine', gap: 0.05, dur: 0.18, gain: 0.05 }); },
    boop: () => tone({ type: 'sine', freq: 900, to: 450, dur: 0.14, gain: 0.16 }),
    boing: () => tone({ type: 'triangle', freq: 280, to: 620, dur: 0.18, gain: 0.12 }),
    whirr: () => tone({ type: 'triangle', freq: 400, to: 1100, dur: 0.35, gain: 0.07 }),
    love: () => { tone({ type: 'sine', freq: 1318, dur: 0.22, gain: 0.09 }); tone({ type: 'sine', freq: 1760, dur: 0.3, gain: 0.09, delay: 0.12 }); },
    sparkle: () => notes([1568, 2093, 2637], { type: 'sine', gap: 0.04, dur: 0.16, gain: 0.05 }),
    pop: () => tone({ type: 'sine', freq: 500, to: 1200, dur: 0.08, gain: 0.12 }),
    dizzy: () => { tone({ type: 'triangle', freq: 900, to: 300, dur: 0.6, gain: 0.08 }); tone({ type: 'triangle', freq: 700, to: 250, dur: 0.6, gain: 0.05, delay: 0.1 }); },
    sad: () => tone({ type: 'sine', freq: 560, to: 330, dur: 0.5, gain: 0.08 }),
    sob: () => {
      tone({ type: 'sine', freq: 620, to: 380, dur: 0.35, gain: 0.08 });
      tone({ type: 'sine', freq: 560, to: 320, dur: 0.4, gain: 0.08, delay: 0.4 });
      noise({ dur: 0.18, gain: 0.05, type: 'highpass', from: 2500, to: 4000, delay: 0.85 });
    },
    powerDown: () => tone({ type: 'sawtooth', freq: 620, to: 50, dur: 0.9, gain: 0.06, filter: { freq: 1500 } }),
    powerUp: () => tone({ type: 'sawtooth', freq: 70, to: 620, dur: 0.6, gain: 0.05, filter: { freq: 1500 } }),
    chime: () => { tone({ type: 'sine', freq: 1046, dur: 0.35, gain: 0.06 }); tone({ type: 'sine', freq: 1568, dur: 0.45, gain: 0.05, delay: 0.08 }); },
  };

  // Bella's babble: a short blip every few letters, pitched by her mood
  const VOICE = { happy: 720, love: 780, wow: 860, blush: 760, wink: 690, cool: 520, think: 580, surprised: 920, sad: 380, cry: 330, sleepy: 300, dizzy: 640, idle: 640 };

  /* ---- the intro hum ---- */

  const drone = {
    nodes: null,
    start() {
      const c = ready();
      if (!c || this.nodes) return;
      const out = c.createGain();
      out.gain.setValueAtTime(0.0001, c.currentTime);
      out.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.6);
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      const oscs = [55, 82.5, 110].map((freq, i) => {
        const osc = c.createOscillator();
        osc.type = i === 1 ? 'triangle' : 'sawtooth';
        osc.frequency.value = freq;
        osc.connect(filter);
        osc.start();
        return osc;
      });
      filter.connect(out);
      out.connect(master);
      this.nodes = { out, filter, oscs };
    },
    /** 0..1: the filter opens and the pitch rises as loading progresses. */
    level(progress) {
      if (!this.nodes || !ctx) return;
      const t = ctx.currentTime;
      this.nodes.filter.frequency.setTargetAtTime(260 + progress * 1400, t, 0.15);
      this.nodes.oscs.forEach((osc, i) => osc.frequency.setTargetAtTime([55, 82.5, 110][i] * (1 + progress * 0.5), t, 0.2));
    },
    stop() {
      if (!this.nodes || !ctx) return;
      const { out, oscs } = this.nodes;
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      oscs.forEach((osc) => osc.stop(t + 0.55));
      this.nodes = null;
    },
  };

  /* ---- public API and the speaker buttons ---- */

  function syncButtons() {
    document.querySelectorAll('.sound-toggle').forEach((btn) => {
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      btn.setAttribute('aria-label', enabled ? 'Turn sound effects off' : 'Turn sound effects on');
      btn.title = enabled ? 'Sound on' : 'Sound off';
      const icon = btn.querySelector('i');
      if (icon) icon.className = `fas ${enabled ? 'fa-volume-high' : 'fa-volume-xmark'} text-sm`;
      const label = btn.querySelector('[data-sound-label]');
      const running = ctx && ctx.state === 'running';
      if (label) label.textContent = !enabled ? 'Sound: off' : running ? 'Sound: on' : 'Sound: tap to start';
    });
  }

  function setEnabled(value) {
    enabled = !!value;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
    if (enabled) {
      audio();
      // A confirmation chirp once the browser has unlocked audio
      setTimeout(() => { if (ready()) SOUNDS.on(); }, 40);
    } else {
      drone.stop();
    }
    syncButtons();
    document.dispatchEvent(new CustomEvent('ky:soundchange', { detail: { enabled } }));
  }

  window.KYSound = {
    get enabled() { return enabled; },
    setEnabled,
    toggle() { setEnabled(!enabled); },
    /** Play a named sound; `gap` (ms) skips it if the same sound played more recently than that. */
    play(name, { gap = 0 } = {}) {
      const sound = SOUNDS[name];
      if (!sound || !ready()) return;
      const now = performance.now();
      if (gap && now - (lastPlayed.get(name) || -1e9) < gap) return;
      lastPlayed.set(name, now);
      sound();
    },
    voice(mood) {
      const base = VOICE[mood] || VOICE.idle;
      tone({ type: 'square', freq: base * (0.85 + Math.random() * 0.35), dur: 0.045, gain: 0.035, filter: { freq: 2400 } });
    },
    drone,
    syncButtons,
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.sound-toggle');
    if (!btn) return;
    e.stopPropagation(); // in the intro, the speaker button must not count as "skip"
    if (enabled && lockedAtGesture) {
      // Sound was on but the browser had it locked: this click just started it
      audio();
      setTimeout(() => { syncButtons(); document.dispatchEvent(new CustomEvent('ky:soundchange', { detail: { enabled } })); }, 60);
      return;
    }
    setEnabled(!enabled);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncButtons);
  else syncButtons();
})();
