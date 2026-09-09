// scrollRevealController.js
// ScrollRevealController component (design.md Component 1).
// Fires a one-time "reveal" animation on any element as it scrolls into
// view. Replaces sectionScrollObserver.js's navigation model (see
// design.md Migration & Module Disposition) - this module only reveals
// elements, it has no notion of "current section".
//
// Implements:
//   - observe(elements): Task 7.1 (Requirement 8.2) - IntersectionObserver
//     path, threshold 0.15, adds .reveal--visible and unobserve()s on
//     first intersection, at most once per element.
//   - observe(elements): Task 7.2 (Requirement 10.1) - reduced-motion /
//     no-IntersectionObserver-support path, calling revealNow()
//     synchronously for every element instead of ever creating an
//     IntersectionObserver.
//   - revealNow(element): the reduced-motion mechanism AND a standalone
//     exported function per design.md's INTERFACE ScrollRevealController.

/** CSS media query used to detect the user's reduced-motion preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Threshold (design.md Algorithmic Pseudocode: ScrollRevealController.observe) -
 * element must be ~15% into the viewport before it's considered revealed. */
const INTERSECTION_THRESHOLD = 0.15;

/** Class added to an element once it has been revealed (Requirement 8.2). */
const REVEAL_VISIBLE_CLASS = 'reveal--visible';

/**
 * Detects whether the user prefers reduced motion, following the same
 * pattern already used in heroSection.js/sparkleBackground.js: guard
 * against a non-browser environment (no `window.matchMedia`) by
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
 * Detects whether `IntersectionObserver` is available in the current
 * environment (guards against a non-browser/test environment, per
 * design.md's `hasIntersectionObserver()` check).
 *
 * @returns {boolean}
 */
function hasIntersectionObserver() {
  return typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function';
}

/**
 * Reveals a single element immediately/synchronously by adding
 * `.reveal--visible` to it. This is both the mechanism behind the
 * reduced-motion/no-support path in `observe()` and a standalone function
 * per design.md's `INTERFACE ScrollRevealController` (e.g. usable directly
 * by tests, or by any caller that wants to reveal one element on demand).
 *
 * No-ops gracefully if `element` is missing/falsy, and is idempotent -
 * calling it again on an already-revealed element is harmless (adding a
 * class that's already present is a no-op).
 *
 * @param {Element} element
 */
export function revealNow(element) {
  if (!element || typeof element.classList === 'undefined') {
    return;
  }
  element.classList.add(REVEAL_VISIBLE_CLASS);
}

/**
 * Registers every element in `elements` for a one-time scroll-triggered
 * reveal animation. Each element carries its own
 * `data-reveal-direction` attribute (fade-up | slide-left | slide-right |
 * zoom-in) read directly from the DOM - this function doesn't need to know
 * or care which direction any given element uses, only the CSS rules keyed
 * off that attribute do.
 *
 * IF `prefers-reduced-motion` is set OR `IntersectionObserver` isn't
 * available in this environment (non-browser/test), every element in
 * `elements` is revealed immediately via `revealNow()` and no
 * `IntersectionObserver` is ever created (Requirement 10.1).
 *
 * OTHERWISE, a single `IntersectionObserver` (threshold: 0.15, per
 * design.md's pseudocode) is created and set to observe every element in
 * `elements`. On an element's first intersection past that threshold,
 * `.reveal--visible` is added to it and `observer.unobserve(element)` is
 * called - so a reveal fires at most once per element, ever; scrolling
 * back and forth past it again never re-adds or re-triggers it
 * (Requirement 8.2).
 *
 * @param {Element[]} elements
 */
export function observe(elements) {
  if (prefersReducedMotion() || !hasIntersectionObserver()) {
    for (const el of elements) {
      revealNow(el);
    }
    return;
  }

  const observer = new window.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add(REVEAL_VISIBLE_CLASS);
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: INTERSECTION_THRESHOLD });

  for (const el of elements) {
    observer.observe(el);
  }
}
