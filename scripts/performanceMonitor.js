// performanceMonitor.js
// PerformanceMonitor: sliding-window frame-time degradation detector.
//
// Extracted from the removed fairyTransitionController.js's frame-time
// monitor (design.md Component 7) - the *technique* (sliding 2000ms
// window, rolling-average threshold, one-way "degraded" flag) is reused
// verbatim; only its home module and what it degrades have changed.
// fairyTransitionController.js no longer exists in this codebase (deleted
// in task 1 of this spec), so this is a fresh implementation built from
// design.md's specification rather than a copy of the old source.
//
// Module pattern: this file mirrors sparkleBackground.js's module-level
// `state` object singleton, rather than a factory/class. There is exactly
// one performance timeline per page load (there's only one
// requestAnimationFrame loop worth of frames to monitor, shared by every
// consumer - ParallaxController and AmbientParticleField both poll the
// same isDegraded() per design.md Component 7), so a singleton matches the
// project's existing convention for "one instance per page" modules
// (sparkleBackground.js) rather than the per-instance construction used by
// data-shaped modules like eventConfigValidator.js's validators.
//
// Detection rule (design.md Component 7 / Error Scenario 6): a
// rolling-average frame time >=33ms sustained for >=2000ms flips
// isDegraded() to true, permanently, for the rest of the session. Once
// true, later fast frames never un-set it - this is a one-way flag by
// design, matching the prior fairyTransitionController.js behavior.

/** Trailing window size, in ms, used to compute the rolling-average frame time. */
const ROLLING_WINDOW_MS = 2000;

/** Rolling-average frame time, in ms, at/above which the window counts as "slow". */
const SLOW_FRAME_THRESHOLD_MS = 33;

/**
 * Module-level state for the single PerformanceMonitor instance. Kept
 * minimal and private, mirroring sparkleBackground.js's `state` object -
 * there is one shared frame-time timeline per page load, and every
 * consumer (ParallaxController, AmbientParticleField) polls the same
 * isDegraded() result rather than each owning its own monitor.
 */
const state = {
  // Timestamps (rAF `nowMs` values) of every recorded frame that still
  // falls within the trailing ROLLING_WINDOW_MS window. Oldest first.
  frameTimestamps: [],
  degraded: false,
};

/**
 * Records one animation frame at `nowMs` (the timestamp an animation loop
 * receives from its requestAnimationFrame callback, or any equivalent
 * monotonically-increasing clock reading).
 *
 * Internally keeps a sliding trailing window of frame timestamps spanning
 * the last ROLLING_WINDOW_MS. Once that window both (a) spans a full
 * ROLLING_WINDOW_MS or more of elapsed time and (b) has a rolling-average
 * frame time >= SLOW_FRAME_THRESHOLD_MS across it, `degraded` is set to
 * true and never reset - isDegraded() returns true for the rest of the
 * session from that point on, even if frame times improve afterward.
 *
 * Out-of-order/non-increasing `nowMs` values (defensive - shouldn't happen
 * with a real rAF timestamp) are ignored rather than allowed to corrupt
 * the window, so a single bad reading can't force or block degradation.
 *
 * @param {number} nowMs
 */
export function recordFrame(nowMs) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
    return;
  }

  const { frameTimestamps } = state;
  const previous = frameTimestamps[frameTimestamps.length - 1];
  if (previous !== undefined && nowMs <= previous) {
    return;
  }

  frameTimestamps.push(nowMs);

  // Drop timestamps that have fallen out of the trailing window, keeping
  // at most one "just outside the window" entry so the average below is
  // computed across a span that still covers the full window rather than
  // silently shrinking to less than ROLLING_WINDOW_MS worth of frames.
  const cutoff = nowMs - ROLLING_WINDOW_MS;
  while (frameTimestamps.length > 2 && frameTimestamps[1] < cutoff) {
    frameTimestamps.shift();
  }

  if (state.degraded || frameTimestamps.length < 2) {
    return;
  }

  const oldest = frameTimestamps[0];
  const newest = frameTimestamps[frameTimestamps.length - 1];
  const windowSpanMs = newest - oldest;

  // Only judge the average once the window actually covers a full
  // ROLLING_WINDOW_MS - a couple of slow frames right at startup shouldn't
  // trigger degradation before there's 2000ms of real history to judge.
  if (windowSpanMs < ROLLING_WINDOW_MS) {
    return;
  }

  const averageFrameTimeMs = windowSpanMs / (frameTimestamps.length - 1);
  if (averageFrameTimeMs >= SLOW_FRAME_THRESHOLD_MS) {
    state.degraded = true;
  }
}

/**
 * Returns whether sustained low frame rate has been detected this session.
 * Once true, always true - degradation never un-sets itself, matching the
 * one-way persistence choice carried forward from the prior implementation.
 *
 * @returns {boolean}
 */
export function isDegraded() {
  return state.degraded;
}
