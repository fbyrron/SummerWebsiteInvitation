// parallaxController.js
// ParallaxController (design.md Component 3).
// This module implements init(layers) (Task 8.1 / Requirements 8.3, 8.4),
// its reduced-motion guard (Task 8.2 / Requirement 10.2),
// enableMouseParallax(heroElement) (Task 8.3 / Requirement 8.3), and the
// PerformanceMonitor.isDegraded() wiring (Task 8.4 / Requirement 11.4).
//
// Drives the three-layer parallax backdrop: a single requestAnimationFrame
// loop reads window.scrollY once per frame and applies a clamped
// translate3d(...) offset to every registered layer, following design.md's
// "ParallaxController tick" pseudocode exactly (including the defensive
// clamp - Property 4: parallax offsets never exceed one viewport height).
//
// Once PerformanceMonitor.isDegraded() flips true, the per-frame layer
// offset writes stop (design.md Component 7: "ParallaxController disables
// layer offsets first (cheapest, least visible loss)") - each layer is
// simply left at whatever transform it last had. The rAF loop itself keeps
// running (so it can keep polling isDegraded() and so the optional mouse
// parallax enhancement, if enabled, is unaffected), only the layer-offset
// computation/write is skipped.

import { isDegraded } from './performanceMonitor.js';

/** CSS media query used to detect the user's reduced-motion preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** CSS media query used to detect a fine-pointer (mouse/trackpad) device. */
const POINTER_FINE_QUERY = '(pointer: fine)';

/** Maximum mouse-parallax offset, in pixels, applied in either axis. */
const MOUSE_PARALLAX_MAX_OFFSET_PX = 6;

/**
 * Module-level state for the single running parallax rAF loop. Kept
 * minimal and private; init() is the only way to (re)populate `layers`.
 * The `mouseParallax` sub-object is populated only if/when
 * enableMouseParallax() is called - init(layers)'s own behavior never
 * touches it.
 */
const state = {
  layers: [],
  animationFrameId: null,
  mouseParallax: {
    heroElement: null,
    offsetX: 0,
    offsetY: 0,
    listenerAttached: false,
  },
};

/**
 * Detects whether the user prefers reduced motion, following the same
 * pattern already used in heroSection.js/sparkleBackground.js: guard
 * against a non-browser environment (no `window.matchMedia`) by defaulting
 * to the motion-safe choice.
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
 * Clamps `value` to the inclusive range [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Writes the hero element's mouse-parallax transform from the latest
 * mouse-derived offset stored in `state.mouseParallax` by the `mousemove`
 * handler registered in enableMouseParallax(). Read+applied here, inside
 * the same tick() the three scroll-parallax layers already use, per
 * design.md ("recomputed in the same rAF loop rather than a second
 * timer") - there is no second rAF cycle/listener-driven loop for this.
 *
 * No-ops if enableMouseParallax() was never called (heroElement is null),
 * so init(layers)'s own behavior is completely unaffected when this
 * optional enhancement isn't in use.
 */
function applyMouseParallax() {
  const { heroElement, offsetX, offsetY } = state.mouseParallax;
  if (!heroElement) {
    return;
  }
  heroElement.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
}

/**
 * The requestAnimationFrame loop body. Mirrors design.md's
 * `parallaxTick(layers)` pseudocode: reads `window.scrollY` once per frame
 * (not once per layer), computes each layer's clamped offset, writes the
 * transform, then reschedules itself for the next frame.
 *
 * Defensive clamp (Property 4): no layer's offset is ever allowed to
 * exceed one viewport height (`window.innerHeight`) in either direction,
 * regardless of how large `scrollY * layer.speed` grows on a long page.
 *
 * Once `PerformanceMonitor.isDegraded()` reports true (Requirement 11.4 /
 * design.md Component 7), the per-frame layer-offset computation/write is
 * skipped entirely - each layer is left frozen at whatever transform it
 * last had. The rAF loop keeps rescheduling itself regardless, so it can
 * keep polling isDegraded() and so the optional mouse-parallax
 * enhancement (a separate, cheaper effect) isn't killed along with it.
 */
function tick() {
  if (!isDegraded()) {
    const scrollY = window.scrollY;
    const maxOffset = window.innerHeight;

    for (const layer of state.layers) {
      const raw = scrollY * layer.speed;
      const offsetY = clamp(raw, -maxOffset, maxOffset);
      layer.element.style.transform = `translate3d(0, ${offsetY}px, 0)`;
    }
  }

  applyMouseParallax();

  state.animationFrameId = window.requestAnimationFrame(tick);
}

/**
 * Detects whether the current device reports a fine pointer (mouse or
 * trackpad) via `(pointer: fine)`, per design.md's `enableMouseParallax()`
 * gating. Guards against a non-browser environment (no `window.matchMedia`)
 * by defaulting to false, so this enhancement never activates when it
 * can't be verified - touch-only devices report `(pointer: coarse)` and
 * correctly fail this check.
 *
 * @returns {boolean}
 */
function hasFinePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(POINTER_FINE_QUERY).matches;
}

/**
 * `mousemove` handler: stores the latest cursor-derived offset (clamped to
 * ±6px per design.md) in `state.mouseParallax` for tick() to read+apply on
 * the next animation frame. Does not touch the DOM directly - all writes
 * happen inside tick()'s single rAF loop, per design.md ("recomputed in
 * the same rAF loop rather than a second timer").
 *
 * The offset is derived from the cursor's position relative to the
 * viewport center, normalized to [-1, 1] on each axis and scaled by
 * MOUSE_PARALLAX_MAX_OFFSET_PX.
 *
 * @param {MouseEvent} event
 */
function handleMouseMove(event) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const normalizedX = (event.clientX / viewportWidth) * 2 - 1;
  const normalizedY = (event.clientY / viewportHeight) * 2 - 1;

  state.mouseParallax.offsetX = clamp(
    normalizedX * MOUSE_PARALLAX_MAX_OFFSET_PX,
    -MOUSE_PARALLAX_MAX_OFFSET_PX,
    MOUSE_PARALLAX_MAX_OFFSET_PX,
  );
  state.mouseParallax.offsetY = clamp(
    normalizedY * MOUSE_PARALLAX_MAX_OFFSET_PX,
    -MOUSE_PARALLAX_MAX_OFFSET_PX,
    MOUSE_PARALLAX_MAX_OFFSET_PX,
  );
}

/**
 * Enables the optional mouse-parallax progressive enhancement on
 * `heroElement` (design.md Component 3 / Task 8.3, Requirement 8.3).
 *
 * On devices reporting `(pointer: fine)`, tracks the cursor via a
 * `mousemove` listener and applies a small additional (±6px) offset to
 * `heroElement`, computed inside the same tick() rAF loop `init(layers)`
 * already drives - no second loop or listener-driven rAF cycle is started.
 *
 * NEVER activates:
 * - under `prefers-reduced-motion` (reuses the same `prefersReducedMotion()`
 *   guard `init()` uses), or
 * - on devices where `(pointer: fine)` doesn't match (touch-only devices) -
 *   gated explicitly on the media query rather than relying solely on the
 *   absence of `mousemove` events there, per design.md's wording.
 *
 * Purely additive/optional: if this is never called, `init(layers)`'s own
 * behavior is completely unaffected (tick()'s `applyMouseParallax()` no-ops
 * while `state.mouseParallax.heroElement` stays null).
 *
 * No-ops gracefully in a non-browser/test environment (no `window`), and
 * is safe to call before or after init(layers).
 *
 * @param {Element} heroElement
 */
export function enableMouseParallax(heroElement) {
  if (typeof window === 'undefined') {
    return;
  }

  if (prefersReducedMotion() || !hasFinePointer()) {
    return;
  }

  state.mouseParallax.heroElement = heroElement;

  if (!state.mouseParallax.listenerAttached) {
    window.addEventListener('mousemove', handleMouseMove);
    state.mouseParallax.listenerAttached = true;
  }
}

/**
 * Registers the parallax layers and starts the parallax loop.
 *
 * IF `prefers-reduced-motion` is set, the requestAnimationFrame loop is
 * never started at all (Requirement 10.2) - every layer is left exactly
 * as authored, with no transform ever applied by this module.
 *
 * OTHERWISE, starts a single requestAnimationFrame loop that reads
 * `window.scrollY` once per frame and applies
 * `translate3d(0, clamp(scrollY * layer.speed, -viewportHeight,
 * viewportHeight), 0)` to each registered layer (Requirements 8.3, 8.4).
 *
 * No-ops gracefully in a non-browser/test environment (no `window` or no
 * `requestAnimationFrame`), matching this project's existing defensive
 * pattern (see sparkleBackground.js's initSparkleBackground()).
 *
 * @param {Array<{element: Element, speed: number}>} layers
 */
export function init(layers) {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return;
  }

  state.layers = Array.isArray(layers) ? layers : [];

  if (prefersReducedMotion()) {
    // Requirement 10.2: real, permanent skip - no rAF loop, no transform
    // ever written, every layer stays at its authored resting position.
    return;
  }

  state.animationFrameId = window.requestAnimationFrame(tick);
}
