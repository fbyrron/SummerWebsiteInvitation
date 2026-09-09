// gallerySection.js
// Component 10: GallerySection (design.md, "Princess Gallery" scene).
//
// -----------------------------------------------------------------------
// THIS PASS: a portrait gallery in a castle
// -----------------------------------------------------------------------
// Rewritten from full-bleed background-photo panels to framed portraits
// hung on a castle wall, per the user's request that the gallery photos be
// the thing that looks "like a picture frame in a castle".
//
// Each photo is now a real `<img>` mounted in an ornate gilt picture frame
// (`.gilded-frame`/`.gilded-frame__mat`, styles/castleOrnate.css — the same
// shared moulding the landing page's invite frame uses, so the two pages
// read as one house style), hung from a picture rail by a visible cord,
// with an engraved gold nameplate beneath it. The wall behind them is
// CSS-painted castle masonry with arched niches (styles/gallery.css).
//
// Three things changed structurally, and each for a specific reason:
//
//   1. background-image -> <img>. The previous panels set each photo as a
//      CSS `background-image` on a <div>, which meant the photos carried no
//      `alt` and could not be framed (a background cannot be inset inside a
//      mat). Real <img> elements restore both.
//
//   2. min-height: 100vh per panel -> a portrait grid. Three stacked
//      full-viewport panels made the gallery three screens of scrolling. A
//      framed portrait is meant to be seen as an object on a wall, at a
//      size where several are visible together, so they now sit in a
//      responsive grid — one column on a phone, three across on a wide
//      screen (styles/gallery.css).
//
//   3. Overlaid caption -> engraved nameplate. A caption sitting on top of
//      a photo needed a dark scrim to stay legible, which flattened the
//      photo. On a gallery wall the label belongs on a plaque below the
//      frame instead, so the scrim is gone entirely and the photo is shown
//      unobscured.
//
// This module still does not import photoFrame.js. That helper
// (photoFrame.js/photoFrame.css) builds a thin-bordered white Luma-minimal
// card, which is the opposite of the ornate gilt moulding wanted here, and
// its `object-fit: contain` letterboxes a portrait photo inside a square
// frame. Both files are left completely untouched; note they may now be
// entirely unused, which is not a bug and is out of scope to clean up here.
//
// Accessibility: each photo now carries a real `alt` describing it, AND the
// same text is rendered as the visible nameplate below the frame. That is
// intentionally the same string in both places rather than two different
// ones — a screen reader announces the image's alt, then reads the plaque,
// which reads naturally as "photo, then its label", the way a real gallery
// wall works. Every decorative layer (wall, rail, cord, corner ornaments)
// is `aria-hidden` and non-interactive.
//
// No config parameter: per design.md's stated interface (`render()` takes
// no arguments) and its explicit note that "there is no gallery data in
// the config schema... the photo files below are static asset references
// baked into GallerySection, not config-driven."
//
// Uses createElement/textContent/attribute-setting for all real content,
// matching this codebase's existing XSS-safety convention (see
// eventDetailsSection.js/entourageSection.js). The static decorative SVG
// corner ornaments inserted via insertAdjacentHTML contain no interpolated
// data at all.

import { observe } from './scrollRevealController.js';

/**
 * The gallery's portraits. Static asset references — not config-driven —
 * per the design's explicit note that GallerySection carries no photo
 * content from EventConfig.
 *
 * All source photos are portrait (~1366x2049, a 2:3 ratio), which is why
 * styles/gallery.css mounts them at `aspect-ratio: 2 / 3` with
 * `object-fit: cover`: at their native ratio nothing is cropped at all, and
 * a future photo at a different ratio is centre-cropped rather than
 * distorted or letterboxed inside its mat.
 *
 * `revealDirection` alternates left/centre/right so the three frames don't
 * all slide in identically. `fade-up` is kept for the middle one so the row
 * settles inward from both sides rather than sweeping in one direction.
 */
const GALLERY_SLOTS = [
  {
    slot: 'gallery-portrait-1',
    label: 'Summer smiling in the garden',
    src: 'assets/summer-photos/0c916870-f108-4633-924f-b9470ad9cbe1.jpg',
    revealDirection: 'slide-right',
  },
  {
    slot: 'gallery-portrait-2',
    label: 'Summer playing outdoors',
    src: 'assets/summer-photos/1fa9e8ef-131b-4c0c-9129-dd6d8c88988d.jpg',
    revealDirection: 'fade-up',
  },
  {
    slot: 'gallery-portrait-3',
    // Swapped at the user's request. The label changed with it, because the
    // label is BOTH the visible nameplate and the photo's `alt` - leaving the
    // previous "Summer laughing outside" on this photo would have described
    // the wrong picture to a screen-reader user, which is worse than a stale
    // caption. This one shows her in a gold-and-pink tiara holding a bouquet
    // of pale pink roses.
    label: 'Summer in her crown, holding pink roses',
    src: 'assets/summer-photos/89ddacad-42bb-4c38-82b0-58e43c10f07d.jpg',
    revealDirection: 'slide-left',
  },
];

/**
 * Builds the CSS-painted castle wall the portraits hang on: an empty,
 * `aria-hidden` layer whose masonry courses, arched wall niches, and torch
 * glow are all painted with CSS gradients in styles/gallery.css.
 *
 * A single empty div rather than an image asset, matching the same
 * CSS-painted-backdrop approach already used for the landing page's garden
 * (`.hero-bg-garden`, styles/heroOrnate.css) — this project has no
 * background photography and isn't expected to gain any.
 *
 * @returns {HTMLDivElement}
 */
function buildWall() {
  const wall = document.createElement('div');
  wall.className = 'gallery__wall';
  wall.setAttribute('aria-hidden', 'true');
  return wall;
}

/**
 * Builds the picture rail the portraits hang from: a moulded horizontal
 * band across the wall, level with the top of the frames. Decorative only.
 *
 * @returns {HTMLDivElement}
 */
function buildRail() {
  const rail = document.createElement('div');
  rail.className = 'gallery__rail';
  rail.setAttribute('aria-hidden', 'true');
  return rail;
}

/**
 * Builds one portrait: the hanging cord, the gilt frame with the photo
 * mounted in its mat, and the engraved nameplate beneath.
 *
 * The frame carries BOTH `gilded-frame` (the shared moulding surface,
 * styles/castleOrnate.css) and `gallery__frame` (this scene's own size and
 * aspect, styles/gallery.css). Same split for the mat. That is what lets
 * the landing page's invite frame and these portraits share one gilt
 * treatment while sizing themselves completely independently.
 *
 * `data-reveal-direction` goes on the outer `.gallery__portrait`, not the
 * frame, so the cord, frame, and plaque all animate in together as one
 * object instead of separately.
 *
 * @param {{slot: string, label: string, src: string, revealDirection: string}} item
 * @returns {HTMLDivElement}
 */
function buildPortrait({ slot, label, src, revealDirection }) {
  const portrait = document.createElement('div');
  portrait.className = 'gallery__portrait';
  portrait.dataset.photoSlot = slot;
  portrait.setAttribute('data-reveal-direction', revealDirection);

  // Hanging cord: a decorative V of two thin lines from the rail down to
  // the frame's top corners, drawn with the element's own pseudo-elements
  // in CSS (no further DOM needed).
  const cord = document.createElement('div');
  cord.className = 'gallery__cord';
  cord.setAttribute('aria-hidden', 'true');
  portrait.appendChild(cord);

  const frame = document.createElement('div');
  frame.className = 'gilded-frame gallery__frame';

  const mat = document.createElement('div');
  mat.className = 'gilded-frame__mat gallery__mat';

  const photo = document.createElement('img');
  photo.className = 'gallery__photo';
  photo.src = src;
  photo.alt = label;
  photo.loading = 'lazy';
  photo.decoding = 'async';
  // Intrinsic size, so the browser reserves the right box before the photo
  // arrives and the wall doesn't reflow as each one loads. The CSS
  // aspect-ratio governs the rendered box; these are the source dimensions.
  photo.width = 1366;
  photo.height = 2049;

  mat.appendChild(photo);
  frame.appendChild(mat);
  portrait.appendChild(frame);

  const plaque = document.createElement('div');
  plaque.className = 'gallery__plaque';

  const plaqueLabel = document.createElement('p');
  plaqueLabel.className = 'gallery__plaque-label';
  plaqueLabel.textContent = label;
  plaque.appendChild(plaqueLabel);

  portrait.appendChild(plaque);

  return portrait;
}

/**
 * Static markup for the small gilt corner scroll that sits in each of the
 * hall's four corners, finishing the wall the way real panelling does.
 * 100% static — no interpolated data — so this stays consistent with this
 * module's textContent-only convention for real content.
 *
 * @param {string} modifierClass
 * @returns {string}
 */
function buildHallCornerMarkup(modifierClass) {
  return `<svg class="gallery__corner ${modifierClass}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M2 2 H30 M2 2 V30" fill="none" stroke="#D8B25C" stroke-width="2" stroke-linecap="round"/>
  <path d="M2 12 C14 12 22 6 24 2" fill="none" stroke="#D8B25C" stroke-width="1.4" stroke-linecap="round" opacity="0.85"/>
  <circle cx="7" cy="7" r="2.4" fill="#D8B25C"/>
</svg>`;
}

/** The four hall corners, each with its own positioning modifier class. */
const HALL_CORNER_MODIFIERS = [
  'gallery__corner--tl',
  'gallery__corner--tr',
  'gallery__corner--bl',
  'gallery__corner--br',
];

/**
 * Renders the Princess Gallery scene into `#gallery`.
 *
 * Clears and rebuilds `#gallery`'s content on every call, matching the
 * clear-and-rebuild idempotency pattern used by `renderDetails()`
 * (eventDetailsSection.js) and `renderEntourage()` (entourageSection.js).
 *
 * Structure built:
 *
 *   #gallery
 *     .gallery__wall            CSS-painted masonry + arched niches
 *     .gallery__content
 *       h2.gallery__heading     "Princess Gallery"
 *       .gallery__rail          the picture rail
 *       .gallery__portraits     the grid
 *         .gallery__portrait x3   cord + gilt frame + plaque
 *       .gallery__corner x4     gilt corner scrolls
 *
 * The heading stays a standalone heading above the wall of portraits rather
 * than being overlaid on a photo: it now reads against the pale masonry,
 * which needs no scrim at all.
 *
 * Registers all three portraits with `ScrollRevealController.observe(...)`
 * in one call, same as every prior version of this scene.
 */
export function render() {
  const section = document.getElementById('gallery');
  if (!section) {
    return;
  }

  // Clear any existing content before re-rendering.
  section.textContent = '';

  section.appendChild(buildWall());

  const content = document.createElement('div');
  content.className = 'gallery__content';

  const heading = document.createElement('h2');
  heading.className = 'gallery__heading';
  heading.textContent = 'Princess Gallery';
  content.appendChild(heading);

  content.appendChild(buildRail());

  const portraits = document.createElement('div');
  portraits.className = 'gallery__portraits';

  const revealTargets = GALLERY_SLOTS.map((item) => {
    const portrait = buildPortrait(item);
    portraits.appendChild(portrait);
    return portrait;
  });

  content.appendChild(portraits);

  for (const modifier of HALL_CORNER_MODIFIERS) {
    content.insertAdjacentHTML('beforeend', buildHallCornerMarkup(modifier));
  }

  section.appendChild(content);

  observe(revealTargets);
}

export default render;
