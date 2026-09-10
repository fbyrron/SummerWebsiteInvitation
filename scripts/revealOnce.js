// revealOnce.js
// A tiny "add a class the first time this element scrolls into view" helper.
//
// -----------------------------------------------------------------------
// WHY THIS EXISTS, SEPARATE FROM scrollRevealController.js
// -----------------------------------------------------------------------
// scrollRevealController.js already does "reveal on scroll", but it is built
// for ENTRANCE reveals: it reads a `data-reveal-direction` attribute and the
// base.css rules for that attribute start the element at `opacity: 0` and slide
// it in. Routing the sway/scroll-open through it would drag those hidden/offset
// starting states along too, and every element would need a direction attribute
// it does not otherwise want.
//
// What the sway and the scroll-open actually need is narrower: a plain marker
// class added the first time the element is seen, so a FINITE CSS animation can
// be gated on it and thus (a) start on view rather than on page load - which
// matters for elements far down the page, or they would finish animating before
// you scrolled to them - and (b) run a fixed number of iterations and then stop,
// which is the "play briefly, then rest" behaviour asked for.
//
// So this helper adds exactly one class, `is-in-view`, once, and does nothing
// else. No opacity, no transform, no direction - the CSS owns all of that.
//
// -----------------------------------------------------------------------
// FALLBACKS
// -----------------------------------------------------------------------
// - No IntersectionObserver (old browser / test env): the class is added
//   immediately, so the animation still plays. Better a slightly mistimed
//   animation than none.
// - prefers-reduced-motion: the class is STILL added (this helper does not
//   inspect motion preference); the CSS animations gated on it are what carry
//   the `@media (prefers-reduced-motion: reduce)` guards, so motion is removed
//   at the styling layer where the rest of this project's motion guards live.

/** The one class this helper adds. CSS gates finite animations on it. */
const IN_VIEW_CLASS = 'is-in-view';

/**
 * Adds `is-in-view` to each element the first time it scrolls into view, then
 * stops watching it. At most once per element.
 *
 * @param {Iterable<Element>} elements
 * @param {{threshold?: number}} [options] fraction of the element that must be
 *   visible before it counts as "in view" (default 0.25 - a quarter showing).
 */
export function revealOnce(elements, { threshold = 0.25 } = {}) {
  const list = Array.from(elements || []).filter(Boolean);
  if (list.length === 0) {
    return;
  }

  // No observer support (or non-browser): reveal everything now. The animation
  // may play before it is on screen, but it still plays - the acceptable
  // degradation.
  if (typeof IntersectionObserver !== 'function') {
    list.forEach((el) => el.classList.add(IN_VIEW_CLASS));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add(IN_VIEW_CLASS);
        obs.unobserve(entry.target); // once only
      }
    }
  }, { threshold });

  list.forEach((el) => observer.observe(el));
}

export default revealOnce;
