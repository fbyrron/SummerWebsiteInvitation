// sceneCameo.js
// Shared SceneCameo helper.
//
// One small builder for the gilt oval portrait that now heads each scene on
// details.html, per the user's request to put Summer's image in every section.
//
// -----------------------------------------------------------------------
// WHY A SHARED MODULE AND NOT STATIC MARKUP
// -----------------------------------------------------------------------
// The dividers and the footer are static markup in details.html, because they
// sit BETWEEN sections. A cameo sits INSIDE one, and every section module clears
// its own element on render (`section.textContent = ''`), so anything written
// into the HTML there would be wiped on first paint. It has to be built by the
// module that owns the section.
//
// Four modules need the same thing, so it lives here rather than four times over
// - the same reasoning as glassCard.js and photoFrame.js.
//
// -----------------------------------------------------------------------
// WHY THESE ARE DECORATIVE (empty alt, aria-hidden)
// -----------------------------------------------------------------------
// Deliberate, and worth stating because it looks like an omission. Each cameo is
// the same subject the Princess Gallery already presents with real descriptions,
// repeated as an ornament at the head of a scene. Giving each one descriptive alt
// text would make a screen reader announce a photo of Summer four more times
// while a user is trying to reach the party details - noise, not information.
//
// So: `alt=""` plus `aria-hidden="true"` on the wrapper, which is the correct
// treatment for a decorative image whose content is conveyed elsewhere. The
// gallery remains the place her photos are described.
//
// -----------------------------------------------------------------------
// WHY NOT PhotoFrame OR .gilded-frame
// -----------------------------------------------------------------------
// photoFrame.js builds a thin-bordered white Luma-minimal card - the wrong look,
// and its `object-fit: contain` would letterbox a portrait inside a square.
// `.gilded-frame` (styles/castleOrnate.css) is the heavy rectangular moulding the
// gallery portraits hang in; reusing it here would mean four more rectangular
// gilt frames on a page that already has three, which is exactly the "the frame
// stops meaning anything" problem. The default cameo is an OVAL locket - a
// different object at a different scale, so it reads as an accent rather than
// competing with the gallery wall.
//
// -----------------------------------------------------------------------
// VARIANTS
// -----------------------------------------------------------------------
// One cameo size stopped being enough. The entourage and event-details cameos
// were asked to be bigger, and the countdown cameo now uses that same larger
// oval. Rather than hardcode one size and special-case the rest at each call
// site, `build()` takes a `variant`, and each maps to a modifier class the CSS
// styles (styles/castleOrnate.css):
//
//   'oval'  (default)  the gilt oval locket with a hanging loop
//   'large'            the same locket, sized up (entourage, event-details,
//                      countdown)
//
// (A third 'card' variant - a rounded rectangle matching the glass-card - once
// existed for the countdown when its cameo sat inside the card. That layout was
// reverted; the cameo moved back above the card and now uses 'large' like the
// other scenes, so 'card' was removed.)
//
// Uses createElement and attribute assignment only, never innerHTML.

import { revealOnce } from './revealOnce.js';

/** Marker class applied to every cameo wrapper. */
const CAMEO_CLASS = 'scene-cameo';

/** Per-variant modifier classes (styles/castleOrnate.css). */
const VARIANT_CLASS = {
  oval: '',
  large: 'scene-cameo--large',
};

/**
 * Builds one gilt cameo of Summer, in one of two sizes.
 *
 * `src` is a static asset path chosen by the calling section, not config data -
 * eventConfig.js carries no per-scene photo field, the same reason
 * gallerySection.js hardcodes its three portraits (see design.md's note that
 * gallery photos are "static asset references... not config-driven").
 *
 * `variant` picks the treatment (see the VARIANTS note in this module's header):
 * 'oval' (default) or 'large'. An unknown value falls back to the plain oval
 * rather than throwing - a cameo with no modifier is always a valid cameo.
 *
 * Lazy-loaded and `decoding="async"`: every cameo except the first is below the
 * fold on arrival, and none of them is content a guest is waiting for.
 *
 * @param {{src: string, variant?: 'oval'|'large'}} options
 * @returns {HTMLDivElement}
 */
export function build({ src, variant = 'oval' }) {
  const cameo = document.createElement('div');
  const modifier = VARIANT_CLASS[variant] || '';
  cameo.className = modifier ? `${CAMEO_CLASS} ${modifier}` : CAMEO_CLASS;
  // Decorative repetition of gallery content - see this module's header.
  cameo.setAttribute('aria-hidden', 'true');

  const img = document.createElement('img');
  img.className = 'scene-cameo__img';
  img.src = src;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';

  cameo.appendChild(img);

  // Sway on view. revealOnce() adds `.is-in-view` the first time the cameo
  // scrolls into frame; styles/castleOrnate.css gates a brief finite sway on
  // that class, so the locket swings from its hanging loop when you reach it and
  // then rests. Registering here (rather than at each of the three call sites)
  // keeps the behaviour in one place - every cameo the builder makes gets it.
  revealOnce([cameo]);

  return cameo;
}

export default build;
