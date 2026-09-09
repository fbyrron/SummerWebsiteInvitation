// sparkleBackground.js
// Ambient twinkling sparkle background - a visual-polish addition, separate
// from and independent of sparkleParticleSystem.js (the fairy-flight
// transition sparkle trail, Component 4 in design.md). This module has no
// shared imports/constants with that file on purpose: the two features
// serve different concerns (an always-on decorative backdrop vs. a
// short-lived transition effect) and must not interfere with each other.
//
// Redesign pass: this module is now also the implementation of design.md's
// AmbientParticleField component (see "Extends" in that section) - the
// ambient canvas/particle system below was kept as the base and extended
// in place, per the Migration & Module Disposition table, rather than
// rewritten or split into a second module. `setDensity()` and the
// butterfly-sprite pool are that extension; everything else in this file
// is the original ambient sparkle behavior, unchanged.
//
// Exposes initSparkleBackground() and setDensity(), which together:
//   - create (idempotently) a full-viewport, click-through <canvas>,
//     inserted as the first child of <body> so it paints behind #app,
//   - seed a small set of twinkling, slow-drifting particles, plus a small
//     pool of ambient butterfly sprites that occasionally drift across the
//     full page width on their own independent, randomized schedules
//     (unrelated to scroll position),
//   - animate them via requestAnimationFrame only (never setInterval,
//     matching this project's existing convention - see
//     fairyTransitionController.js/heroSection.js), all from the single rAF
//     loop started by initSparkleBackground() - setDensity() never starts a
//     second loop or canvas,
//   - respect `prefers-reduced-motion` by rendering exactly one static
//     frame and never starting the animation loop at all (butterflies
//     included - they only ever move/advance from inside that loop, so
//     under reduced motion they never animate or appear),
//   - no-op gracefully in a non-browser/test environment.
//
// Task 9.3: the effective particle cap now also factors in
// PerformanceMonitor.isDegraded() (design.md Property 6) - see
// getEffectiveParticleCount() below for the combined formula, and
// animate() for how a mid-session degraded transition gets picked up
// without a page reload.

import { isDegraded } from './performanceMonitor.js';

/** Id of the ambient sparkle background canvas. */
export const SPARKLE_BG_CANVAS_ID = 'sparkle-bg';

/** CSS media query used to detect the user's reduced-motion preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Viewport width, in px, at/below which the narrower particle count applies. */
const NARROW_BREAKPOINT_PX = 768;

/** Ambient sparkle particle counts, mirroring the device-tier pattern used
 * by sparkleParticleSystem.js's getMaxParticlesForDevice(), but kept as a
 * wholly separate constant/function here - this is a different feature
 * with its own (smaller) counts, not a shared budget. */
const PARTICLE_COUNT_NARROW = 18;
const PARTICLE_COUNT_WIDE = 30;

/** Theme palette, hardcoded here as plain hex strings (matches the
 * Luma-minimal custom properties in styles/base.css). Only 5 colors, so a
 * shared constants module between CSS and JS isn't worth the indirection -
 * see the corresponding task instructions.
 * Redesign pass: swapped the prior blush-pink/lavender/gold set for the
 * new Luma-minimal palette (white/border-gray/accent-blue/page-bg/soft
 * gray-blue) so the ambient shimmer stays subtle and matches the current
 * theme. The accent blue is kept sparse, one of five entries, the same
 * ratio the old gold accent used. */
const PARTICLE_COLORS = [
  '#FFFFFF', // card-bg white
  '#E3E8EF', // border gray
  '#2563EB', // accent blue, used sparingly
  '#F7F9FC', // page bg blue-white
  '#CBD5E1', // soft neutral gray-blue, for a bit of tonal variety
];

/** Particle radius bounds, in px. */
const MIN_RADIUS_PX = 1;
const MAX_RADIUS_PX = 3;

/** Particle base-opacity bounds. */
const MIN_BASE_OPACITY = 0.3;
const MAX_BASE_OPACITY = 0.5;

/** Slow per-frame drift velocity bounds, in px/frame. */
const MAX_DRIFT_PX = 0.02;

/** Twinkle speed bounds - how fast each particle's sine-wave opacity cycles. */
const MIN_TWINKLE_SPEED = 0.0008;
const MAX_TWINKLE_SPEED = 0.003;

/** Debounce delay for the window resize handler, in ms. Resize isn't a
 * per-frame animation concern, so a short timeout-based debounce is fine
 * here (distinct from the animation loop itself, which stays rAF-only). */
const RESIZE_DEBOUNCE_MS = 150;

/** Maximum number of ambient butterfly sprites in the pool at once (design.md
 * Component 4: "a small pool of butterfly sprites (2-3 max)"). Each one is
 * scheduled independently, so in practice fewer than this may be flying at
 * any given moment. */
const MAX_BUTTERFLIES = 3;

/** How far past the left/right canvas edge a butterfly starts/ends its
 * crossing, in px, so it fades into view rather than popping in exactly at
 * the edge. */
const BUTTERFLY_EDGE_MARGIN_PX = 40;

/** Bounds, in ms, for how long a single butterfly waits before its next
 * crossing (both its very first one and every respawn afterward). Kept
 * long and wide so multiple butterflies drift across on a lazy, unrelated
 * schedule rather than in sync with each other. */
const BUTTERFLY_RESPAWN_DELAY_MIN_MS = 6000;
const BUTTERFLY_RESPAWN_DELAY_MAX_MS = 20000;

/** Bounds, in ms, for how long one full page-width crossing takes. */
const BUTTERFLY_FLIGHT_DURATION_MIN_MS = 10000;
const BUTTERFLY_FLIGHT_DURATION_MAX_MS = 20000;

/** Vertical bobbing amplitude/speed, so the crossing isn't a perfectly
 * straight line. */
const BUTTERFLY_BOB_AMPLITUDE_PX = 14;
const BUTTERFLY_BOB_SPEED = 0.0015;

/** Wing-flap oscillation speed. */
const BUTTERFLY_WING_FLAP_SPEED = 0.006;

/** Butterfly sprite sizing, in px (kept small/cheap - a decorative touch,
 * not a detailed illustration). */
const BUTTERFLY_BODY_RADIUS_PX = 2;
const BUTTERFLY_WING_RADIUS_PX = 7;

/** Butterfly wing colors, drawn from the same theme palette as the ambient
 * particles for visual consistency. */
const BUTTERFLY_WING_COLORS = ['#FFFFFF', '#E3E8EF', '#2563EB'];

/**
 * Module-level state for the single ambient sparkle canvas instance. Kept
 * minimal and private; initSparkleBackground() is the only way to create or
 * re-enter this state, and it is idempotent (see below).
 */
const state = {
  canvas: null,
  ctx: null,
  particles: [],
  butterflies: [],
  densityMultiplier: 1,
  animationFrameId: null,
  resizeTimer: null,
  reducedMotion: false,
  // Last-observed result of isDegraded(), checked once per animate() frame
  // (see animate()) so a mid-session false->true flip re-seeds the
  // particle/butterfly pools without needing a resize or setDensity()
  // call to trigger it. isDegraded() is a one-way flag (never flips back
  // to false), so this only ever needs to react to that single transition.
  lastDegraded: false,
};

/**
 * Detects whether the user prefers reduced motion, following the same
 * pattern already used in heroSection.js/fairyTransitionController.js:
 * guard against a non-browser environment (no `window.matchMedia`) by
 * defaulting to the motion-safe choice.
 *
 * @returns {boolean}
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Returns a random float in [min, max).
 *
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Returns the ambient sparkle particle count for the current viewport
 * width: PARTICLE_COUNT_NARROW for widths <= 768px, PARTICLE_COUNT_WIDE
 * otherwise. Defaults to the narrower, more conservative count when there
 * is no viewport to measure (non-browser environment).
 *
 * @returns {number}
 */
function getParticleCountForViewport() {
  if (typeof window === 'undefined' || typeof window.innerWidth !== 'number') {
    return PARTICLE_COUNT_NARROW;
  }
  return window.innerWidth <= NARROW_BREAKPOINT_PX ? PARTICLE_COUNT_NARROW : PARTICLE_COUNT_WIDE;
}

/** Floor on the effective particle count once degraded mode is active
 * (design.md Property 6: "the effective cap is max(10, base * 0.5)"). */
const DEGRADED_MIN_PARTICLES = 10;

/** Multiplier applied to the base cap once degraded mode is active. */
const DEGRADED_MULTIPLIER = 0.5;

/**
 * Returns the effective ambient particle cap for the current viewport,
 * combining three inputs per design.md Property 6:
 *   - `base` = the existing viewport-tiered count
 *     (`getParticleCountForViewport()`: 30 at <=768px, 60 at >768px),
 *   - `PerformanceMonitor.isDegraded()`, and
 *   - `state.densityMultiplier` (set via `setDensity()`, default 1).
 *
 * Degraded mode takes precedence over the density multiplier rather than
 * combining with it: once `isDegraded()` is true, the cap is
 * `max(10, base * 0.5)` regardless of `state.densityMultiplier` - the
 * multiplier is not applied at all in that branch. This matches Property
 * 6's "bump and degradation are mutually exclusive in practice -
 * degradation, once triggered, wins" rule: a struggling device should
 * never be pushed to render *more* particles just because
 * `ClosingSection.setDensity(1.6)` was also called.
 *
 * Re-evaluates `isDegraded()` on every call rather than caching it, since
 * it can flip from false to true mid-session (see the `animate()` loop's
 * periodic re-check for how that transition gets picked up without a
 * resize/setDensity() call).
 *
 * When not degraded, behavior is unchanged from before: `round(base *
 * state.densityMultiplier)`, floored at 1 so a caller can never
 * accidentally zero out the field.
 *
 * @returns {number}
 */
function getEffectiveParticleCount() {
  const base = getParticleCountForViewport();

  if (isDegraded()) {
    return Math.max(DEGRADED_MIN_PARTICLES, Math.round(base * DEGRADED_MULTIPLIER));
  }

  const scaled = Math.round(base * state.densityMultiplier);
  return Math.max(1, scaled);
}

/**
 * Creates one ambient sparkle particle, positioned randomly within a
 * `width` x `height` canvas area (CSS pixels, not device pixels - the
 * canvas context is scaled by devicePixelRatio separately, so particle
 * math stays in CSS-pixel space throughout).
 *
 * @param {number} width
 * @param {number} height
 * @returns {Object}
 */
function createParticle(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: randomBetween(MIN_RADIUS_PX, MAX_RADIUS_PX),
    baseOpacity: randomBetween(MIN_BASE_OPACITY, MAX_BASE_OPACITY),
    twinkleSpeed: randomBetween(MIN_TWINKLE_SPEED, MAX_TWINKLE_SPEED),
    // Random phase offset so particles twinkle out of sync with each
    // other, rather than all pulsing in lockstep.
    twinklePhase: Math.random() * Math.PI * 2,
    driftVx: randomBetween(-MAX_DRIFT_PX, MAX_DRIFT_PX),
    driftVy: randomBetween(-MAX_DRIFT_PX, MAX_DRIFT_PX),
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    // A few particles get a soft glow for visual variety; kept cheap (only
    // drawn for the larger particles) since this runs continuously.
    glow: false,
  };
}

/**
 * Creates one ambient butterfly sprite in its initial "waiting" phase -
 * not yet visible/flying. `waitUntil` is left `null` and gets set to a
 * randomized wake time on the first animation frame that observes it (see
 * `updateButterflies()`), rather than at seed time, since seeding can
 * happen before any rAF timestamp is available.
 *
 * @param {number} height - current CSS-pixel canvas height, used to pick
 *   a random vertical baseline for this butterfly's crossing.
 * @returns {Object}
 */
function createButterfly(height) {
  return {
    phase: 'waiting',
    waitUntil: null,
    direction: 1,
    y: randomBetween(height * 0.1, height * 0.7),
    x: 0,
    currentY: 0,
    startTime: 0,
    duration: 0,
    bobPhase: Math.random() * Math.PI * 2,
    wingPhase: Math.random() * Math.PI * 2,
    wingFlap: 0,
    color: BUTTERFLY_WING_COLORS[Math.floor(Math.random() * BUTTERFLY_WING_COLORS.length)],
  };
}

/**
 * Returns the effective butterfly-pool size: `MAX_BUTTERFLIES` normally,
 * or halved (floored at 1) once `PerformanceMonitor.isDegraded()` is true -
 * design.md Component 4 calls out that "particle count and butterfly count
 * both drop before anything else is cut" under sustained low frame rate,
 * so the butterfly pool gets the same degraded-mode treatment as
 * `getEffectiveParticleCount()`, using the same halving rule (no separate
 * "floor of 10" here since 10 would exceed MAX_BUTTERFLIES - a floor of 1
 * is the sensible equivalent for a pool this small).
 *
 * @returns {number}
 */
function getEffectiveButterflyCount() {
  if (isDegraded()) {
    return Math.max(1, Math.round(MAX_BUTTERFLIES * DEGRADED_MULTIPLIER));
  }
  return MAX_BUTTERFLIES;
}

/**
 * (Re)seeds `state.butterflies` with up to `getEffectiveButterflyCount()`
 * sprites (normally `MAX_BUTTERFLIES`, halved under degraded mode - see
 * that function), each starting in its own "waiting" phase so their first
 * crossing times end up independently staggered (see
 * `updateButterflies()`). Only ever called when motion is allowed - under
 * `prefers-reduced-motion` the pool is left empty (see
 * `initSparkleBackground()`/`handleResize()`), matching the existing
 * particle static-frame behavior: no butterfly ever renders or animates in
 * that case.
 *
 * @param {number} height
 */
function seedButterflies(height) {
  const count = getEffectiveButterflyCount();
  const butterflies = [];
  for (let i = 0; i < count; i++) {
    butterflies.push(createButterfly(height));
  }
  state.butterflies = butterflies;
}

/**
 * Puts `butterfly` into its "flying" phase: picks a fresh random
 * direction, flight duration, and bob/wing phase offsets, then starts
 * timing the crossing from `timestampMs`.
 *
 * @param {Object} butterfly
 * @param {number} timestampMs
 */
function startButterflyFlight(butterfly, timestampMs) {
  butterfly.direction = Math.random() < 0.5 ? 1 : -1;
  butterfly.duration = randomBetween(BUTTERFLY_FLIGHT_DURATION_MIN_MS, BUTTERFLY_FLIGHT_DURATION_MAX_MS);
  butterfly.startTime = timestampMs;
  butterfly.bobPhase = Math.random() * Math.PI * 2;
  butterfly.wingPhase = Math.random() * Math.PI * 2;
  butterfly.phase = 'flying';
}

/**
 * Advances every butterfly in `state.butterflies` by one frame. Each
 * butterfly alternates independently between two phases:
 *   - 'waiting': invisible, counting down to its own randomized next
 *     crossing time (`waitUntil`) - not tied to any other butterfly's
 *     schedule, and not tied to scroll position at all.
 *   - 'flying': drifting the full page width (plus a small off-screen
 *     margin on each end) over `duration` ms, with a gentle vertical bob
 *     and a wing-flap phase for the draw step to use.
 * On completing a crossing, a butterfly returns to 'waiting' and schedules
 * its own next crossing independently.
 *
 * @param {number} timestampMs
 * @param {number} width
 */
function updateButterflies(timestampMs, width) {
  for (const butterfly of state.butterflies) {
    if (butterfly.phase === 'waiting') {
      if (butterfly.waitUntil === null) {
        butterfly.waitUntil = timestampMs + randomBetween(BUTTERFLY_RESPAWN_DELAY_MIN_MS, BUTTERFLY_RESPAWN_DELAY_MAX_MS);
      }
      if (timestampMs >= butterfly.waitUntil) {
        startButterflyFlight(butterfly, timestampMs);
      }
      continue;
    }

    const progress = (timestampMs - butterfly.startTime) / butterfly.duration;
    if (progress >= 1) {
      butterfly.phase = 'waiting';
      butterfly.waitUntil = null;
      continue;
    }

    const travel = width + BUTTERFLY_EDGE_MARGIN_PX * 2;
    const startX = butterfly.direction === 1 ? -BUTTERFLY_EDGE_MARGIN_PX : width + BUTTERFLY_EDGE_MARGIN_PX;
    butterfly.x = startX + butterfly.direction * travel * progress;
    butterfly.currentY = butterfly.y + Math.sin(timestampMs * BUTTERFLY_BOB_SPEED + butterfly.bobPhase) * BUTTERFLY_BOB_AMPLITUDE_PX;
    butterfly.wingFlap = Math.sin(timestampMs * BUTTERFLY_WING_FLAP_SPEED + butterfly.wingPhase);
  }
}

/**
 * Draws every currently-flying butterfly as a simple, cheap 2-lobed wing
 * shape (two `ctx.arc()` circles for wings plus a small body dot) - a
 * small ambient decorative touch, not a detailed illustration. Butterflies
 * in the 'waiting' phase are off-screen/invisible and are skipped.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
function drawButterflies(ctx) {
  for (const butterfly of state.butterflies) {
    if (butterfly.phase !== 'flying') {
      continue;
    }

    const flap = Math.abs(butterfly.wingFlap);
    const wingScale = 0.5 + flap * 0.5;
    const wingRadius = BUTTERFLY_WING_RADIUS_PX * wingScale;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = butterfly.color;

    ctx.beginPath();
    ctx.arc(butterfly.x - wingRadius * 0.6, butterfly.currentY, wingRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(butterfly.x + wingRadius * 0.6, butterfly.currentY, wingRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5a4a3f';
    ctx.beginPath();
    ctx.arc(butterfly.x, butterfly.currentY, BUTTERFLY_BODY_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/**
 * (Re)seeds `state.particles` for the given CSS-pixel canvas size. Called
 * on init and again after a resize, since a resize changes the area
 * particles should be distributed across.
 *
 * @param {number} width
 * @param {number} height
 */
function seedParticles(width, height) {
  const count = getEffectiveParticleCount();
  const particles = [];
  for (let i = 0; i < count; i++) {
    const particle = createParticle(width, height);
    // Roughly 1 in 6 of the larger particles gets a soft glow, for a bit of
    // variety without making every particle expensive to draw.
    particle.glow = particle.radius > 2.2 && i % 6 === 0;
    particles.push(particle);
  }
  state.particles = particles;
}

/**
 * Sizes `canvas` for crisp rendering on high-DPI screens: the canvas'
 * backing store (`canvas.width`/`canvas.height`) is set to the CSS size
 * multiplied by `devicePixelRatio`, and the drawing context is scaled by
 * that same factor so all subsequent draw calls can keep using CSS-pixel
 * coordinates.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @returns {{width: number, height: number}} the CSS-pixel size used.
 */
function sizeCanvasForDpr(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Reset any prior scale before reapplying - ctx.scale() is cumulative,
  // and this function can run again on resize.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  return { width, height };
}

/**
 * Draws every particle's current state (assumes opacity/position have
 * already been computed for this frame by updateParticles(), or are the
 * static base values for the reduced-motion single-frame case).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawParticles(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);

  for (const particle of state.particles) {
    ctx.save();
    ctx.globalAlpha = particle.currentOpacity ?? particle.baseOpacity;

    if (particle.glow) {
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.radius * 4,
      );
      gradient.addColorStop(0, particle.color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Advances every particle's twinkle phase and drift position by one frame,
 * wrapping drift around the canvas edges so a particle that drifts off one
 * side reappears on the opposite side rather than disappearing.
 *
 * @param {number} timestampMs - current animation timestamp, from rAF.
 * @param {number} width
 * @param {number} height
 */
function updateParticles(timestampMs, width, height) {
  for (const particle of state.particles) {
    particle.x += particle.driftVx;
    particle.y += particle.driftVy;

    if (particle.x < 0) particle.x += width;
    if (particle.x > width) particle.x -= width;
    if (particle.y < 0) particle.y += height;
    if (particle.y > height) particle.y -= height;

    const wave = Math.sin(timestampMs * particle.twinkleSpeed + particle.twinklePhase);
    // Map sine's [-1, 1] onto a gentle range around baseOpacity, clamped to
    // a sensible [0.05, 1.0] visible range.
    const twinkled = particle.baseOpacity + wave * 0.3;
    particle.currentOpacity = Math.min(1.0, Math.max(0.05, twinkled));
  }
}

/**
 * The requestAnimationFrame loop body: updates then redraws every
 * particle, and schedules the next frame. Stored on `state.animationFrameId`
 * so it can be checked/cancelled (idempotent init, cleanup) if ever needed.
 *
 * @param {number} timestampMs
 */
function animate(timestampMs) {
  const { canvas, ctx } = state;
  if (!canvas || !ctx) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  // isDegraded() is a one-way flag (see performanceMonitor.js) that can
  // flip from false to true at any point mid-session, but particles are
  // otherwise only re-seeded on resize or setDensity() calls. Checking
  // once per already-scheduled rAF frame (rather than adding a
  // setInterval poll, which would break this file's rAF-only convention)
  // catches that transition and re-seeds immediately, so the particle/
  // butterfly cap reacts without requiring a resize or page reload. This
  // is just a boolean comparison on every frame - re-seeding itself only
  // runs once, on the frame where the transition is first observed.
  const degradedNow = isDegraded();
  if (degradedNow && !state.lastDegraded) {
    seedParticles(width, height);
    seedButterflies(height);
  }
  state.lastDegraded = degradedNow;

  updateParticles(timestampMs, width, height);
  updateButterflies(timestampMs, width);
  drawParticles(ctx, width, height);
  drawButterflies(ctx);

  state.animationFrameId = window.requestAnimationFrame(animate);
}

/**
 * Draws exactly one static frame (particles at their base opacity, no
 * twinkle/drift) and does not start the requestAnimationFrame loop.
 * Used for the `prefers-reduced-motion: reduce` path - a real, permanent
 * skip of the animation loop, not merely a slow one.
 */
function drawStaticFrame() {
  const { canvas, ctx } = state;
  if (!canvas || !ctx) {
    return;
  }
  for (const particle of state.particles) {
    particle.currentOpacity = particle.baseOpacity;
  }
  drawParticles(ctx, window.innerWidth, window.innerHeight);
}

/**
 * Handles a window resize: re-sizes the canvas for the new viewport/DPR,
 * re-seeds particles for the new area, and redraws (either a fresh static
 * frame under reduced motion, or lets the already-running rAF loop pick up
 * the new size on its next frame). Debounced by RESIZE_DEBOUNCE_MS via
 * setTimeout - this is a one-shot layout recalculation, not a per-frame
 * animation, so setTimeout here does not conflict with the "rAF only for
 * animation" rule.
 */
function handleResize() {
  if (state.resizeTimer) {
    clearTimeout(state.resizeTimer);
  }
  state.resizeTimer = setTimeout(() => {
    const { canvas, ctx } = state;
    if (!canvas || !ctx) {
      return;
    }
    const { width, height } = sizeCanvasForDpr(canvas, ctx);
    seedParticles(width, height);
    if (!state.reducedMotion) {
      // Under reduced motion the butterfly pool is intentionally left
      // empty (seeded nowhere), so there is nothing to reseed here in
      // that case - see initSparkleBackground().
      seedButterflies(height);
    }
    if (state.reducedMotion) {
      drawStaticFrame();
    }
    // When motion is allowed, the running rAF loop naturally redraws with
    // the new size/particles on its next scheduled frame - no extra draw
    // call needed here.
  }, RESIZE_DEBOUNCE_MS);
}

/**
 * Marker set directly on the canvas element (not on this module's own
 * state) once it has been initialized, so idempotency is tied to the DOM
 * element itself rather than to module-level state. That distinction
 * matters because it means "has this already run" is answered correctly
 * purely by inspecting the DOM, the same way callers would check - rather
 * than only being correct as long as the exact same `document`/`window`
 * globals are still in place (e.g. across a test file's separate document
 * stubs, or any future re-entrant call in a different realm).
 */
const INITIALIZED_ATTR = 'data-sparkle-initialized';

/**
 * Creates (if one doesn't already exist) the ambient sparkle canvas as the
 * first child of `<body>`, and returns its 2d rendering context plus
 * whether it was already initialized before this call - or `null` if
 * canvas/2d-context support isn't available.
 *
 * Idempotent: if a `#sparkle-bg` canvas already exists, that same element
 * is reused rather than creating a duplicate.
 *
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, alreadyInitialized: boolean} | null}
 */
function ensureCanvas() {
  let canvas = document.getElementById(SPARKLE_BG_CANVAS_ID);
  const alreadyInitialized = Boolean(canvas && canvas.getAttribute && canvas.getAttribute(INITIALIZED_ATTR) === 'true');

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = SPARKLE_BG_CANVAS_ID;
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
  }

  if (typeof canvas.getContext !== 'function') {
    return null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  return { canvas, ctx, alreadyInitialized };
}

/**
 * Initializes the ambient twinkling sparkle background. Safe to call more
 * than once - subsequent calls reuse the existing canvas/particles rather
 * than creating duplicates or restarting an already-running animation loop.
 *
 * No-ops gracefully when running in a non-browser/test environment (no
 * `document`/`window`/`requestAnimationFrame`, or no 2d canvas context
 * support), matching this project's existing defensive pattern (see
 * fairyTransitionController.js's guards).
 *
 * Respects `prefers-reduced-motion: reduce`: draws one static frame and
 * never starts the requestAnimationFrame loop in that case.
 */
export function initSparkleBackground() {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    return;
  }

  const created = ensureCanvas();
  if (!created) {
    return;
  }

  // Idempotent: if this exact canvas element has already been initialized
  // (marked via INITIALIZED_ATTR), don't create a second animation loop or
  // resize listener for it.
  if (created.alreadyInitialized) {
    return;
  }
  created.canvas.setAttribute(INITIALIZED_ATTR, 'true');

  state.canvas = created.canvas;
  state.ctx = created.ctx;
  state.reducedMotion = prefersReducedMotion();
  state.lastDegraded = isDegraded();

  const { width, height } = sizeCanvasForDpr(state.canvas, state.ctx);
  seedParticles(width, height);

  window.addEventListener('resize', handleResize);

  if (state.reducedMotion) {
    // Butterflies are left unseeded (state.butterflies stays []) under
    // reduced motion: they only ever move/appear from inside the rAF loop
    // below, which never starts in this branch, so there is nothing for
    // them to do - same "real, permanent skip" as the particle field.
    drawStaticFrame();
    return;
  }

  seedButterflies(height);
  state.animationFrameId = window.requestAnimationFrame(animate);
}

/**
 * Scales the active ambient particle cap by `multiplier` (e.g. `1.6` for
 * the closing scene's "background becomes more magical" finale - see
 * design.md's AmbientParticleField.setDensity()), re-seeding
 * `state.particles` against the existing viewport-tiered base cap
 * (`getParticleCountForViewport()`) times `multiplier`. Does not create a
 * second canvas or a second `requestAnimationFrame` loop - it only changes
 * how many particles the single existing loop (started by
 * `initSparkleBackground()`) draws on its next frame.
 *
 * No-ops gracefully if called before `initSparkleBackground()` (or in a
 * non-browser/test environment where init never ran), so call order
 * mistakes don't throw.
 *
 * @param {number} multiplier
 */
export function setDensity(multiplier) {
  if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier <= 0) {
    return;
  }
  state.densityMultiplier = multiplier;

  if (!state.canvas || !state.ctx) {
    return;
  }

  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  const height = typeof window !== 'undefined' ? window.innerHeight : 0;
  seedParticles(width, height);

  if (state.reducedMotion) {
    drawStaticFrame();
  }
  // When motion is allowed, the already-running rAF loop picks up the
  // newly-seeded particle count on its next scheduled frame.
}
