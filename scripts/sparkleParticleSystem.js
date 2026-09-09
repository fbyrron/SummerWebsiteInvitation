// sparkleParticleSystem.js
// SparkleParticleSystem component (design.md Component 4).
// This module implements the particle data structure, spawnSparkleAt(position)
// (Task 6.1 / Requirement 3.2), updateAndFadeParticles(deltaMs) (Task 6.2 /
// Requirements 3.2, 3.5), and clearAll()/MAX_PARTICLES_FOR_DEVICE cap
// enforcement (Task 6.3 / Requirement 5.2).

/**
 * Minimum and maximum lifespan (in milliseconds) for a spawned sparkle particle.
 * A short randomized range gives the sparkle trail a natural, non-uniform feel
 * (design.md Component 4: "trailing sparkle particles behind the flying fairy").
 */
const MIN_LIFESPAN_MS = 400;
const MAX_LIFESPAN_MS = 800;

/**
 * Device-tier particle caps (design.md Component 4 / Correctness Property 8,
 * Requirement 5.2): 30 particles for viewport widths <= 768px, 60 for widths
 * > 768px.
 */
const MAX_PARTICLES_NARROW = 30;
const MAX_PARTICLES_WIDE = 60;
const NARROW_BREAKPOINT_PX = 768;

/**
 * Task 10.1 (Requirement 5.4 / design.md Error Scenario 2): "performance
 * degraded" mode flag. Set by fairyTransitionController.js's frame-time
 * monitor once a rolling average frame time of >= 33ms has been sustained
 * for >= 2000ms, via setParticleDegradedMode(true). Kept here (rather than
 * in fairyTransitionController.js) so getMaxParticlesForDevice() can apply
 * the reduced cap internally - every existing caller (spawnSparkleAt, and
 * any test/property code calling getMaxParticlesForDevice() directly) picks
 * up the reduced cap automatically once degradation triggers, with no
 * change needed at those call sites (their function signatures are
 * unchanged).
 *
 * Task 10.1 persistence choice: this flag is never reset back to `false` by
 * this module - see the "persist vs reset" note on
 * fairyTransitionController.js's frame-time monitor for the full reasoning
 * (a sustained low frame rate is treated as a signal about the device's
 * capability for the rest of the session, not a one-transition blip).
 *
 * @type {boolean}
 */
let particleDegradedMode = false;

/**
 * Task 10.1 (Requirement 5.4): sets whether the particle system is in
 * performance-degraded mode. Called by fairyTransitionController.js's
 * frame-time monitor when sustained frame degradation is first detected.
 * Exported (rather than kept fully private) so that module - and tests -
 * can drive this flag without needing a circular import back into this
 * module's internal state.
 *
 * @param {boolean} isDegraded
 */
export function setParticleDegradedMode(isDegraded) {
  particleDegradedMode = Boolean(isDegraded);
}

/**
 * Task 10.1 (Requirement 5.4): reports whether the particle system is
 * currently in performance-degraded mode. Exposed for tests/observability
 * alongside fairyTransitionController.js's own isDegraded().
 *
 * @returns {boolean}
 */
export function isParticleDegradedMode() {
  return particleDegradedMode;
}

/**
 * Task 10.1 (Requirement 5.4): absolute floor on the active particle count
 * once performance-degraded mode is active - never reduce below 10
 * particles, regardless of device tier.
 */
const DEGRADED_MIN_PARTICLES = 10;

/**
 * Returns the device-appropriate maximum active particle count based on the
 * current viewport width (design.md Component 4, Correctness Property 8):
 * 30 for widths <= 768px, 60 for widths > 768px.
 *
 * In a non-browser environment (no `window`, e.g. this file imported under
 * Node for a script/test), there is no viewport to measure. We default to
 * the narrower, mobile-first cap (30) as the more conservative choice rather
 * than assuming a wide desktop viewport.
 *
 * Task 10.1 (Requirement 5.4): once performance-degraded mode is active
 * (setParticleDegradedMode(true) was called), the device-tier cap computed
 * above is additionally reduced by 50%, floored at DEGRADED_MIN_PARTICLES
 * (10) - `max(10, deviceCap * 0.5)` per Requirement 5.4's wording. This
 * takes effect immediately for every subsequent call (including calls made
 * mid-transition), which is safe/snap-free for the particle cap specifically:
 * shrinking the cap only ever causes spawnSparkleAt() to evict slightly more
 * of the oldest particles than before, never a visual jump in the fairy's
 * own position or timing.
 *
 * @returns {number}
 */
export function getMaxParticlesForDevice() {
  const baseCap =
    typeof window === "undefined" || typeof window.innerWidth !== "number"
      ? MAX_PARTICLES_NARROW
      : window.innerWidth <= NARROW_BREAKPOINT_PX
        ? MAX_PARTICLES_NARROW
        : MAX_PARTICLES_WIDE;

  if (!particleDegradedMode) {
    return baseCap;
  }

  return Math.max(DEGRADED_MIN_PARTICLES, Math.floor(baseCap * 0.5));
}

/**
 * Internally-tracked list of currently active particles. Module-level state,
 * mutated by spawnSparkleAt and (in later tasks) updateAndFadeParticles/clearAll.
 * @type {Array<Object>}
 */
const activeParticles = [];

/**
 * Returns a random lifespan in milliseconds within [MIN_LIFESPAN_MS, MAX_LIFESPAN_MS].
 *
 * @returns {number}
 */
function randomLifespanMs() {
  return MIN_LIFESPAN_MS + Math.random() * (MAX_LIFESPAN_MS - MIN_LIFESPAN_MS);
}

/**
 * Particle factory. Creates a new particle data object at the given position.
 * Fields match design.md's particle update pseudocode (age, lifespanMs, opacity).
 *
 * @param {{x: number, y: number}} position
 * @returns {{position: {x: number, y: number}, age: number, lifespanMs: number, opacity: number}}
 */
function createParticle(position) {
  return {
    position: { x: position.x, y: position.y },
    age: 0,
    lifespanMs: randomLifespanMs(),
    opacity: 1.0,
  };
}

/**
 * Spawns a new sparkle particle at the given position and adds it to the
 * active particle list, enforcing the device-appropriate particle cap
 * (design.md Correctness Property 8, Requirement 5.2).
 *
 * Requirement 3.2: render a sparkle particle trail behind the fairy's path.
 *
 * Cap strategy: if the active list is already at (or would exceed) the cap,
 * the oldest particle (index 0 — sparkles are appended in spawn order, so
 * the oldest is also the most-faded) is dropped to make room for the new
 * one at the fairy's current position. This keeps the freshest, most
 * visible sparkle right behind the fairy rather than silently discarding new
 * spawns, which would make the trail visibly lag behind the fairy's tip on
 * low-cap devices.
 *
 * Postcondition: activeParticles.length never exceeds
 * getMaxParticlesForDevice() after this function returns.
 *
 * @param {{x: number, y: number}} position
 */
export function spawnSparkleAt(position) {
  const maxParticles = getMaxParticlesForDevice();

  while (activeParticles.length >= maxParticles) {
    activeParticles.shift();
  }

  activeParticles.push(createParticle(position));
}

/**
 * Removes all active particles immediately (design.md Component 4 /
 * pseudocode "clearAll()", invoked on transition complete per
 * design.md's triggerFairyTransition algorithm — Task 7.8).
 *
 * Postcondition: activeParticles.length === 0.
 *
 * @returns {void}
 */
export function clearAll() {
  activeParticles.length = 0;
}

/**
 * Returns the internally-tracked list of active particles.
 * Exposed for reuse by updateAndFadeParticles/clearAll (Tasks 6.2/6.3) and
 * for property/unit tests.
 *
 * @returns {Array<Object>}
 */
export function getActiveParticles() {
  return activeParticles;
}

/**
 * Rendering hook for a particle that is still active after its opacity has
 * been recomputed for the current frame (design.md pseudocode: "ELSE
 * renderParticle(particle)").
 *
 * No canvas/DOM painting exists yet in this project — this is a data-layer
 * task only. This stub is intentionally a no-op so the call site matches
 * design.md's pseudocode exactly, and is exported so a later visual-rendering
 * task can replace/extend it without changing updateAndFadeParticles.
 *
 * @param {Object} particle
 * @returns {void}
 */
function renderParticle(particle) {
  // Intentional no-op: visual rendering is out of scope for this task.
}

/**
 * Advances every active particle's age by deltaMs, recomputes its opacity,
 * and removes particles whose opacity has reached zero or below.
 * Implements design.md's "Sparkle particle update" pseudocode exactly.
 *
 * Requirement 3.2: sparkle trail particles fade over their lifetime.
 * Requirement 3.5: particles are cleaned up once expired.
 *
 * Precondition: deltaMs is non-negative. A negative deltaMs violates the
 * precondition and is treated as a no-op (particles are left unchanged)
 * rather than allowed to age particles backwards/resurrect expired ones.
 *
 * Postcondition: every particle remaining in activeParticles satisfies
 * 0.0 < opacity <= 1.0; every particle with age >= lifespanMs has been
 * removed from activeParticles.
 *
 * @param {number} deltaMs
 * @returns {void}
 */
export function updateAndFadeParticles(deltaMs) {
  if (deltaMs < 0) {
    return;
  }

  // Iterate back-to-front so splicing an expired particle out of the array
  // doesn't skip or re-visit any other particle during this pass.
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const particle = activeParticles[i];

    particle.age += deltaMs;
    particle.opacity = 1.0 - particle.age / particle.lifespanMs;

    if (particle.opacity <= 0.0) {
      activeParticles.splice(i, 1);
    } else {
      renderParticle(particle);
    }
  }
}

// Exported for reuse by later tasks (6.2/6.3) and property tests.
export { createParticle, MIN_LIFESPAN_MS, MAX_LIFESPAN_MS, renderParticle };
