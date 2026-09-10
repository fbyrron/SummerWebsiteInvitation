// fairyTransition.js
// A cross-page "fairy" transition for the landing page's VIEW DETAILS link.
//
// -----------------------------------------------------------------------
// WHY THIS IS A REWRITE
// -----------------------------------------------------------------------
// The first version injected a full-screen overlay, animated it, then set
// location.href after a timer. Three problems the user hit:
//   1. It didn't feel like a transition - it was a flash on the OLD page,
//      then a hard cut to a cold new page. No motion was shared between the
//      two pages.
//   2. On BACK, the browser restored the landing page from its bfcache - a
//      snapshot taken WHILE the overlay was mid-animation - so the overlay
//      came back frozen at peak brightness. That was the "stuck shine".
//   3. The sparkles were washed out by the bloom.
//
// This version uses the browser's own cross-document View Transitions API,
// which is the right tool: the browser snapshots the OUTGOING page, loads the
// new page, and animates one into the other as a single continuous motion that
// IT owns. Because the browser drives the whole lifecycle, there is no overlay
// left in the DOM and nothing to get stuck in bfcache. The look (a soft gold
// shimmer/zoom) is defined purely in CSS via ::view-transition pseudo-elements
// in styles/heroOrnate.css.
//
// -----------------------------------------------------------------------
// WHAT THIS MODULE ACTUALLY DOES
// -----------------------------------------------------------------------
// Cross-document view transitions are opt-in from CSS (@view-transition), not
// JS - so when the browser supports them, we do NOT need to intercept the
// click at all: the plain <a href="details.html"> navigates and the browser
// plays the transition declared in CSS. This module's ONLY runtime jobs are:
//
//   1. Tag <html> with `data-vt-ready` when the API is present, so the CSS
//      @view-transition opt-in and its animations apply ONLY where they will
//      actually work (and never interfere on browsers that would ignore them).
//   2. A bfcache backstop: on `pageshow` from bfcache, strip any transition
//      leftovers so a restored landing page is always clean. (The new approach
//      shouldn't leave any, but this guarantees the "stuck shine" can never
//      return even if a browser mishandles a snapshot.)
//
// The CTA anchor itself is left exactly as heroSection.js renders it - bare
// <a href="details.html">, still asserted by heroSection.test.js, still works
// with JS off. On browsers without the View Transitions API the link just
// navigates normally: a clean cut, no frozen overlay, no broken back button.

/** Marks <html> when cross-document view transitions are usable. CSS keys off it. */
const READY_ATTR = 'data-vt-ready';

/**
 * True when this browser supports cross-document (multi-page) view transitions.
 *
 * The presence of the `@view-transition` at-rule is the feature signal for the
 * cross-document flavour (distinct from `document.startViewTransition`, which
 * is the same-document API). `CSSViewTransitionRule` exists in engines that
 * ship the cross-document version, so we test for it.
 *
 * @returns {boolean}
 */
function supportsCrossDocumentViewTransitions() {
  return (
    typeof window !== 'undefined' &&
    typeof window.CSSViewTransitionRule === 'function'
  );
}

/**
 * True when the visitor asked for reduced motion. Checked live so a change of
 * preference is respected. When true we do NOT tag <html>, so the CSS
 * transition never opts in and navigation is an ordinary, instant cut.
 *
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Removes any stray view-transition pseudo-root state. Defensive: the
 * cross-document API cleans up after itself, but if a page is ever restored
 * from bfcache mid-transition we want the landing page to come back clean
 * rather than showing a frozen effect (the original bug).
 */
function clearTransitionArtifacts() {
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }
  // Skip any active view transition that a bfcache restore may have frozen.
  const active = document.__activeViewTransition;
  if (active && typeof active.skipTransition === 'function') {
    active.skipTransition();
    document.__activeViewTransition = null;
  }
}

/**
 * Enables the fairy cross-page transition where the browser can play it.
 *
 * Safe to call on every page from the shared main.js: it only tags <html> and
 * registers a `pageshow` guard, both harmless anywhere. A no-op in non-browser
 * / test environments, on browsers without cross-document view transitions, and
 * under prefers-reduced-motion - in every one of those cases the CTA is left as
 * a plain link that simply navigates.
 */
export function initFairyTransition() {
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }

  // bfcache backstop, registered regardless of support: if a restored page was
  // snapshotted mid-transition, clear it so nothing is left frozen on screen.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pageshow', (event) => {
      if (event && event.persisted) {
        clearTransitionArtifacts();
      }
    });
  }

  // Only opt the CSS transition in where it will actually work and is wanted.
  if (!supportsCrossDocumentViewTransitions() || prefersReducedMotion()) {
    return;
  }

  document.documentElement.setAttribute(READY_ATTR, 'true');
}

export default initFairyTransition;
