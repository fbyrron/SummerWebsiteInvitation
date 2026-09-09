// heroSection.js
// HeroSection component (design.md Component 9).
//
// -----------------------------------------------------------------------
// THIS PASS: the artwork IS the screen, the button stacks on top
// -----------------------------------------------------------------------
// The user's instruction: phone-bg.png (laptop-bg.png on wide screens) fills
// the entire landing screen, and the button sits on top of it — a stack.
//
// So the layout is now two layers in one box:
//   1. the artwork, filling the whole viewport (`cover`)
//   2. the button, centred over it
//
// This changed the composition from the previous pass, which fitted the
// artwork with `object-fit: contain` and put the button BELOW it in a flex
// column. That was "artwork, then a button under it". This is "button ON the
// artwork", which is what a stack means and what was asked for.
//
// Two consequences of switching to a full-bleed `cover` background, both
// handled:
//
//   - CROPPING. `cover` crops whatever does not fit the viewport's aspect
//     ratio, and the artwork's lettering must never be cut. That is exactly
//     why there are now TWO source images: phone-bg.png is portrait (1024x1536)
//     for tall phone screens, laptop-bg.png is landscape (1536x1024) for wide
//     ones. A `<picture>` element swaps between them at the 768px breakpoint,
//     so each viewport shape gets the artwork drawn for it and `cover` only
//     ever trims the outer margin, never the words. See buildInvitation().
//
//   - THE BLURRED FILL LAYER IS GONE. It only existed to fill the columns that
//     `contain` left empty on wide screens. `cover` leaves nothing empty, so
//     renderBackdrop() and the `.hero-backdrop` element are removed.
//
// What this module renders now:
//   renderInvitation()    the artwork, a full-bleed <picture>/<img>
//   renderCallToAction()  the one button, stacked over the artwork's lower path
//
// -----------------------------------------------------------------------
// STILL AN <img> (inside a <picture>), NOT A CSS background-image
// -----------------------------------------------------------------------
// The invitation's actual words ("YOU ARE INVITED", "Summer's", "7th
// Birthday") are pixels inside these files. A CSS `background-image` carries
// no text alternative, so it would make the entire invitation unreadable to a
// screen-reader user — the page would announce as an empty region with one
// button. An `<img>` inside `<picture>` keeps a real `alt`, built from
// `config.childName`/`config.age` so it cannot drift from the config, and
// `object-fit: cover` on that img gives the full-bleed fill. `<picture>` is
// the standard, accessible way to serve a different source per viewport while
// keeping one alt and one accessible element.

/**
 * The webfont whose load is raced against a timeout below.
 *
 * The headline is part of the artwork, so the CTA button's engraved Cinzel
 * capitals are the only real webfont text left on this page.
 */
const DECORATIVE_FONT_FAMILY = 'Cinzel';

/** Requirement 1.5: 3000ms load timeout before falling back to a standard font. */
export const DECORATIVE_FONT_TIMEOUT_MS = 3000;

/**
 * CSS class applied when the decorative font fails to load in time
 * (Requirement 1.5). Lands on the CTA button — the page's only webfont text.
 * The rule lives in styles/heroOrnate.css.
 */
const FALLBACK_FONT_CLASS = 'hero-cta-button--fallback-font';

/**
 * Returns the ordinal suffix ("st", "nd", "rd", "th") for a given integer.
 * Handles the 11-13 special case (11th, 12th, 13th) before falling back to
 * the last-digit rule.
 *
 * @param {number} n
 * @returns {string} e.g. "th", "st", "nd", "rd"
 */
function ordinalSuffix(n) {
  const lastTwoDigits = n % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Formats an integer age with its ordinal suffix, e.g. 7 -> "7th", 21 -> "21st".
 *
 * @param {number} age
 * @returns {string}
 */
function formatOrdinal(age) {
  return `${age}${ordinalSuffix(age)}`;
}

/**
 * Builds the hero headline text, e.g. "SUMMER'S 7TH BIRTHDAY" — built from
 * `config.childName`/`config.age` (never hardcoded).
 *
 * No longer rendered anywhere: the headline is lettering inside the artwork.
 * Kept and still exported because it is a pure, tested utility that states
 * this project's canonical "whose birthday, and which one" string in one
 * place, and because `formatOrdinal()` beneath it is used by
 * `buildInvitationAltText()` below.
 *
 * @param {{childName?: string, age?: number}} config
 * @returns {string}
 */
function buildHeadlineText(config) {
  const childName = config && config.childName != null ? String(config.childName) : '';
  const age = config && config.age != null ? config.age : 0;
  return `${childName.toUpperCase()}'S ${formatOrdinal(age).toUpperCase()} BIRTHDAY`;
}

/** Marker class for the positioning wrapper that owns the hero scene. */
const HERO_SCENE_CLASS = 'hero-scene';

/** Marker class for the invitation artwork itself. */
const HERO_INVITATION_CLASS = 'hero-invitation';

/**
 * The two invitation artworks and the viewport at which the wide one takes
 * over. Portrait fills tall phone screens; landscape fills wide ones. The
 * media query string matches styles/heroOrnate.css's own 768px breakpoint, so
 * the source swap and the layout changes happen at the same width.
 */
const HERO_ART_PORTRAIT = { src: 'assets/summer-photos/phone-bg.png', width: 1024, height: 1536 };
const HERO_ART_LANDSCAPE = { src: 'assets/summer-photos/laptop-bg.png', width: 1536, height: 1024 };
const HERO_ART_WIDE_MEDIA = '(min-width: 768px)';

/**
 * Idempotently finds-or-creates `.hero-scene`, the positioning context the
 * artwork and button stack in, as a direct child of `#hero`. Both renderX()
 * functions call this first, so each stays independently callable without
 * depending on `render()` having run or on call order.
 *
 * @param {Element} heroSection
 * @returns {Element} the `.hero-scene` element
 */
function ensureHeroScene(heroSection) {
  let scene = heroSection.querySelector(`.${HERO_SCENE_CLASS}`);
  if (!scene) {
    scene = document.createElement('div');
    scene.className = HERO_SCENE_CLASS;
    heroSection.appendChild(scene);
  }
  return scene;
}

/**
 * Builds the artwork's alt text: a description that also spells out the words
 * the artwork shows, so a screen-reader user gets the invitation itself and
 * not just "image".
 *
 * Built from `config.childName`/`config.age` rather than typed out, for the
 * same reason every other string in this codebase is config-driven: a
 * hardcoded "Summer's 7th Birthday" here would silently contradict the config
 * the moment either value changed.
 *
 * Falls back to a still-useful generic description when config is missing,
 * rather than emitting an alt with a blank name in the middle of it.
 *
 * @param {{childName?: string, age?: number}} config
 * @returns {string}
 */
function buildInvitationAltText(config) {
  const childName = config && config.childName != null ? String(config.childName) : '';
  const age = config && config.age != null ? config.age : null;

  if (!childName || age == null) {
    return 'An enchanted garden invitation with a fairytale castle, roses and butterflies, reading: You are invited.';
  }

  return `An enchanted garden invitation with a fairytale castle, roses and butterflies, reading: You are invited, for ${childName}'s ${formatOrdinal(age)} Birthday.`;
}

/**
 * Renders the invitation artwork as a full-bleed `<picture>` that fills the
 * whole scene, with the button stacked over it (styles/heroOrnate.css).
 *
 * A `<picture>` with two `<source>`s rather than one `<img>`: the artwork must
 * fill the viewport with `cover` without cropping its lettering, and one image
 * cannot do that for both a tall phone and a wide laptop — `cover` would trim
 * the words off whichever shape the single image was not drawn for. So the
 * portrait art serves narrow screens and the landscape art serves wide ones,
 * swapped by a `<source media>` at the same 768px breakpoint the CSS uses.
 *
 * `<picture>` degrades safely: a browser that ignores `<source>` still renders
 * the inner `<img>` (the portrait), so there is always an image.
 *
 * The inner `<img>` carries:
 *   - the real `alt` (see buildInvitationAltText) — one alt for the whole
 *     `<picture>`, which is why this stays accessible,
 *   - intrinsic `width`/`height`, so the box is reserved before load,
 *   - `fetchpriority="high"` and NO `loading="lazy"`: this is the entire
 *     landing view, the one thing a guest opened the link to see, so it must
 *     not be deferred behind anything.
 *
 * Idempotent: a second call is a no-op rather than adding a second picture.
 *
 * @param {{childName?: string, age?: number}} config
 */
export function renderInvitation(config) {
  const heroSection = document.getElementById('hero');
  if (!heroSection) {
    return;
  }

  const scene = ensureHeroScene(heroSection);

  if (scene.querySelector(`.${HERO_INVITATION_CLASS}`)) {
    return;
  }

  const picture = document.createElement('picture');
  picture.className = HERO_INVITATION_CLASS;

  // Wide screens: the landscape artwork.
  const wideSource = document.createElement('source');
  wideSource.media = HERO_ART_WIDE_MEDIA;
  wideSource.srcset = HERO_ART_LANDSCAPE.src;
  wideSource.width = HERO_ART_LANDSCAPE.width;
  wideSource.height = HERO_ART_LANDSCAPE.height;
  picture.appendChild(wideSource);

  // The fallback/default: the portrait artwork. This is the element that
  // carries the alt text and the intrinsic size, and the one every browser
  // renders even if it ignores <source>.
  const img = document.createElement('img');
  img.className = 'hero-invitation__img';
  img.src = HERO_ART_PORTRAIT.src;
  img.width = HERO_ART_PORTRAIT.width;
  img.height = HERO_ART_PORTRAIT.height;
  img.alt = buildInvitationAltText(config);
  img.decoding = 'async';
  img.setAttribute('fetchpriority', 'high');
  picture.appendChild(img);

  scene.appendChild(picture);
}

/** Id of the CTA link appended to the scene by renderCallToAction(). */
const CTA_BUTTON_ID = 'hero-cta-button';

/**
 * The shared fairytale-castle button chrome (styles/castleOrnate.css's
 * `.castle-button`): cast-metal ivory-to-champagne fill, gilt bevelled rim,
 * engraved gold capitals, gilt flourishes flanking the label.
 *
 * Also applied to the RSVP links on details.html, so every primary button on
 * the site is the same object.
 */
const CASTLE_BUTTON_CLASS = 'castle-button';

/**
 * Hero-only positioning modifier. Carries only this page's placement of the
 * button over the artwork (styles/heroOrnate.css) — every visual surface lives
 * in `.castle-button` above.
 *
 * `cta-button` is kept on the element too: it still contributes base.css's
 * shared tap-target and focus-visible handling, so `.castle-button` only has
 * to override the surfaces that differ.
 */
const CTA_ORNATE_CLASS = 'hero-cta-button--ornate';

/**
 * Renders the landing page's one button, stacked over the lower garden path of
 * the artwork (clear of the lettering; see styles/heroOrnate.css for why).
 *
 * A plain `<a href="details.html">VIEW DETAILS</a>` (id `hero-cta-button`).
 * The label is "VIEW DETAILS" (changed from the earlier "BEGIN THE STORY" at
 * the user's request); the destination is unchanged and still NOT
 * "RSVP NOW"/rsvp.html, per the user's explicit earlier
 * confirmation about this artwork. rsvp.html is reached from details.html.
 *
 * Idempotent: if an element with id `hero-cta-button` already exists anywhere
 * in the document, this is a no-op rather than appending a duplicate link.
 * Uses textContent (not innerHTML) for the label, per this project's existing
 * XSS-safety convention.
 */
export function renderCallToAction() {
  const heroSection = document.getElementById('hero');
  if (!heroSection) {
    return;
  }

  if (document.getElementById(CTA_BUTTON_ID)) {
    return;
  }

  const scene = ensureHeroScene(heroSection);

  const link = document.createElement('a');
  link.id = CTA_BUTTON_ID;
  link.className = `cta-button ${CASTLE_BUTTON_CLASS} ${CTA_ORNATE_CLASS}`;
  link.href = 'details.html';
  link.textContent = 'VIEW DETAILS';

  scene.appendChild(link);
}

/**
 * Renders the complete hero into `#hero`: clears any existing content, then
 * the full-bleed artwork and the button stacked over it. This is the single
 * entry point design.md's `INTERFACE HeroSection` calls for
 * (`PROCEDURE render(config: EventConfig)`).
 *
 * The artwork is appended first and the button second: they occupy the same
 * grid cell (styles/heroOrnate.css), so DOM order sets their paint order —
 * artwork behind, button in front — without needing explicit z-index.
 *
 * @param {Object} config - EventConfig-shaped object expected to provide
 *   childName and age (used for the artwork's alt text).
 */
export function render(config) {
  const heroSection = document.getElementById('hero');
  if (!heroSection) {
    return;
  }

  // Clear any existing content before re-rendering, matching the
  // clear-and-rebuild idempotency pattern used elsewhere in this codebase
  // (see eventDetailsSection.js's renderDetails()). The sub-functions below
  // each also guard against double-insertion on their own.
  heroSection.textContent = '';

  renderInvitation(config);
  renderCallToAction();
}

/**
 * Races `document.fonts.load(...)` for the decorative font against a
 * `timeoutMs` timer, resolving `true` if the font finishes loading first and
 * `false` on timeout or on a rejected load. Never rejects - failure is always
 * reported as a resolved `false` so callers don't need a try/catch.
 *
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function loadDecorativeFontWithTimeout(timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    document.fonts.load(`1em "${DECORATIVE_FONT_FAMILY}"`).then(
      () => finish(true),
      () => finish(false),
    );
  });
}

/**
 * Requirement 1.5: waits up to `DECORATIVE_FONT_TIMEOUT_MS` (3000ms) for the
 * decorative font to load, using the CSS Font Loading API (`document.fonts`, a
 * `FontFaceSet`). If it loads in time, no action is needed. If it times out or
 * the load rejects, applies `.hero-cta-button--fallback-font` to the CTA
 * button so the fallback is an explicit 3000ms timeout rather than however
 * long the browser's own font-loading behaviour happens to take.
 *
 * Guards against non-browser environments and browsers without the Font
 * Loading API (no `document.fonts`): in that case we can't verify the load, so
 * we don't force a fallback and let the CSS fallback stack behave naturally.
 *
 * @param {number} [timeoutMs] Optional override for the load timeout, in
 *   milliseconds. Defaults to `DECORATIVE_FONT_TIMEOUT_MS` (3000ms per
 *   Requirement 1.5). Exposed as a parameter purely so unit tests can pass a
 *   short timeout (e.g. 50ms) instead of waiting out the real 3000ms;
 *   production callers should omit it and rely on the default.
 * @returns {Promise<void>}
 */
export async function ensureDecorativeFontOrFallback(timeoutMs = DECORATIVE_FONT_TIMEOUT_MS) {
  if (typeof document === 'undefined' || !document.fonts) {
    return;
  }

  const loaded = await loadDecorativeFontWithTimeout(timeoutMs);
  if (loaded) {
    return;
  }

  const button = document.getElementById(CTA_BUTTON_ID);
  if (button) {
    button.classList.add(FALLBACK_FONT_CLASS);
  }
}

// Exported for unit testing and reuse.
export { formatOrdinal, buildHeadlineText, buildInvitationAltText };
