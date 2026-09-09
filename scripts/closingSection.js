// closingSection.js
// ClosingSection component (design.md Component 14: "rewritten presentation").
// Renders the invitation's final scene into #closing with the exact new
// copy, replacing the prior four-page design's optional config.message
// paragraph entirely.
//
// Multi-page split: this scene now lives on details.html, and RSVP has
// moved to its own dedicated rsvp.html page - so renderClosing() also
// appends a plain `<a href="rsvp.html">` navigation link after the
// signoff/childName line, reusing the shared `.cta-button` class (the
// same accent-blue pill treatment as heroSection.js's "BEGIN THE STORY"
// link) rather than introducing a new class, since both are the same
// kind of primary-action page-to-page link.
//
// Interface is unchanged: renderClosing(config).
//
// Uses textContent/createElement exclusively for every config-interpolated
// value (config.childName, both in the first line and on its own line at
// the end), never innerHTML, per this codebase's existing XSS-safety
// convention (see heroSection.js, entourageSection.js).
//
// Copy source (design.md Component 14 / Requirement 7.1): "Thank you for
// being part of Summer's magical celebration.", "We cannot wait to see you
// in our enchanted garden.", "With Love,", then config.childName on its own
// line. design.md's prose literally writes "Summer's" in the first line,
// but that is the example child's name baked into the design brief, not an
// instruction to hardcode it - the same paragraph explicitly calls out that
// the closing childName line "must come from config so this still works if
// the child's name ever changes." Hardcoding "Summer" in the first line
// would violate that same principle the moment childName changes, so both
// the possessive in line 1 and the standalone name line are built from
// config.childName, matching the config-driven convention already used for
// the headline in heroSection.js (buildHeadlineText).
//
// Task 17.2 (Requirement 7.2): the content wrapper is registered as a
// `fade-up` ScrollRevealController target (same convention as
// entourageSection.js's role groups), and its first reveal also bumps the
// ambient particle field's density to 1.6x via
// AmbientParticleField.setDensity() (sparkleBackground.js's `setDensity()`
// - see the Migration table in design.md: sparkleBackground.js is the base
// implementation of AmbientParticleField). See
// registerDensityBumpOnFirstReveal() below for exactly how "exactly once,
// ever" is guaranteed given ScrollRevealController's actual interface.

import { observe } from './scrollRevealController.js';
import { setDensity } from './sparkleBackground.js';
// sceneCameo is no longer imported here: the closing scene's cameo was removed
// at the user's request (see renderClosing()).

/**
 * Builds the first closing line, e.g. "Thank you for being part of
 * Summer's magical celebration." - built from config.childName (never
 * hardcoded), mirroring design.md's exact phrasing/punctuation with the
 * name interpolated. See the module comment above for why this line is
 * config-driven rather than the literal "Summer's" text from design.md's
 * prose example.
 *
 * @param {{childName?: string}} config
 * @returns {string}
 */
function buildThankYouLine(config) {
  const childName = config && config.childName != null ? String(config.childName) : '';
  return `Thank you for being part of ${childName}'s magical celebration.`;
}

/** Class ScrollRevealController.observe()/revealNow() add to a target
 * element once it has been revealed (see scrollRevealController.js). This
 * module doesn't import that constant (it isn't exported), so it's
 * duplicated here as the one detection signal available to us. */
const REVEAL_VISIBLE_CLASS = 'reveal--visible';

/** design.md's AmbientParticleField.setDensity() multiplier for the
 * closing scene's "background becomes more magical" finale. */
const CLOSING_DENSITY_MULTIPLIER = 1.6;

/**
 * Module-level, page-lifetime flag guarding `setDensity(1.6)` so it fires
 * at most once ever, regardless of how many times `renderClosing()` is
 * called (each call clears/rebuilds #closing and builds a brand new
 * content element) or how many times a reveal-detection callback below
 * might otherwise re-fire.
 */
let hasBumpedAmbientDensityOnReveal = false;

/**
 * Wires `element` so that the *first* time it is revealed by
 * `ScrollRevealController`, `AmbientParticleField.setDensity(1.6)`
 * (`sparkleBackground.js`'s `setDensity()`) is called exactly once - never
 * again after that, no matter how many more times this scene is rendered
 * or "revealed".
 *
 * Why a MutationObserver, given `scrollRevealController.js`'s actual
 * interface today: re-reading that module, `observe(elements)` only ever
 * adds the `reveal--visible` class to an element (via its internal
 * `IntersectionObserver` callback, or synchronously via `revealNow()` on
 * the reduced-motion/no-support path) - it exposes no callback, event, or
 * promise for "this element was just revealed", and isn't designed to. Its
 * own at-most-once guarantee (`unobserve()` after the first intersection,
 * or a single synchronous `revealNow()` pass under reduced motion) is real
 * but only prevents duplicate *reveal-class* application; it gives this
 * module no hook to react to that moment. Rather than fork
 * `scrollRevealController.js` to add a callback param it doesn't otherwise
 * need (no other caller wants one), or bypass it entirely by running a
 * second, independent `IntersectionObserver` here (which would duplicate
 * `ScrollRevealController`'s own detection logic and threshold/
 * reduced-motion handling), watching for the one DOM side effect it
 * already guarantees - the `class` attribute gaining
 * `reveal--visible` - via a `MutationObserver` is the smallest correct
 * hook available. It works identically for both of `observe()`'s paths:
 * the class mutation happens either way, whether applied by the
 * `IntersectionObserver` callback asynchronously on scroll, or by
 * `revealNow()` synchronously under reduced motion (the mutation record is
 * still delivered to this callback on the next microtask either way, so
 * calling this function before `observe()` reliably catches both).
 *
 * The `hasBumpedAmbientDensityOnReveal` flag (checked both before
 * attaching the observer and inside its callback) is what makes this
 * "exactly once, ever" rather than "at most once per element/render call":
 * it survives across every `renderClosing()` re-invocation, since it lives
 * at module scope rather than on the element or inside this function.
 *
 * No-ops gracefully if `MutationObserver` isn't available (non-browser/
 * test environment), matching this codebase's existing defensive
 * convention (see `sparkleBackground.js`'s guards) - there is no other
 * signal available in that case, and `renderClosing()`'s own rendering
 * behavior is otherwise unaffected.
 *
 * @param {Element} element
 */
function bumpAmbientDensityOnFirstReveal(element) {
  if (!element || hasBumpedAmbientDensityOnReveal) {
    return;
  }
  if (typeof MutationObserver !== 'function') {
    return;
  }

  const observer = new MutationObserver(() => {
    if (hasBumpedAmbientDensityOnReveal) {
      observer.disconnect();
      return;
    }
    if (element.classList && element.classList.contains(REVEAL_VISIBLE_CLASS)) {
      hasBumpedAmbientDensityOnReveal = true;
      observer.disconnect();
      setDensity(CLOSING_DENSITY_MULTIPLIER);
    }
  });

  observer.observe(element, { attributes: true, attributeFilter: ['class'] });
}

/**
 * Renders the closing scene's exact copy into #closing.
 *
 * Clears and rebuilds #closing's content on every call, matching the same
 * clear-and-rebuild idempotency pattern used by renderDetails() in
 * eventDetailsSection.js and renderEntourage() in entourageSection.js.
 *
 * @param {Object} config - EventConfig-shaped object expected to provide
 *   childName.
 */
export function renderClosing(config) {
  const section = document.getElementById('closing');
  if (!section) {
    return;
  }

  // Clear any existing content before re-rendering.
  section.textContent = '';

  // Castle pass: the closing copy is now mounted on a PARCHMENT SCROLL, per
  // the user's request to make this scene themed. `.closing__scroll` is the
  // rolled sheet (styles/entourage.css paints the gilt rods across its top
  // and bottom edges and the aged parchment between them);
  // `.closing__content` is unchanged as the content column inside it.
  //
  // A scroll rather than another framed panel or arched niche: this scene is
  // a farewell address, and a proclamation on an unfurled scroll is the
  // fairytale object for a message being READ OUT, where a frame is the
  // object for something being LOOKED AT. It also keeps the three scenes on
  // this page visually distinct - gallery portraits are gilt frames, party
  // details are arched stone niches, the seven symbols are parchment panels
  // with corner brackets, and this is a rolled scroll.
  const scroll = document.createElement('div');
  scroll.className = 'closing__scroll';
  // The reveal target moves up to the scroll, so the whole object (rods,
  // parchment and copy) fades in as one piece rather than the copy animating
  // inside a scroll that is already sitting there. This is still the element
  // the density-bump watcher below observes.
  scroll.setAttribute('data-reveal-direction', 'fade-up');

  const content = document.createElement('div');
  content.className = 'closing__content';

  // No cameo here: removed at the user's request. The other three scenes head
  // with a gilt cameo of Summer, but the closing scroll already ends with her
  // name in large script and a wax seal below it, so a portrait at the top too
  // was one likeness too many for one short panel.

  // Quiet numbered section label, matching the editorial numbered-section
  // convention already established in eventDetailsSection.js ("01") and
  // entourageSection.js ("02") - kept as "03" (unchanged from the prior
  // design) since not every one of the seven scenes carries a number, only
  // this same details/entourage/closing sequence.
  const sectionNumber = document.createElement('p');
  sectionNumber.className = 'section-number';
  sectionNumber.textContent = '03';
  content.appendChild(sectionNumber);

  // Castle pass 2: the user found this scene dull. The first line now carries
  // an extra class so styles/entourage.css can give it an ILLUMINATED DROP
  // CAP - a large gilt initial in the manuscript tradition, which is the
  // single strongest signal that a block of text is a proclamation rather
  // than a paragraph.
  //
  // Done with a class plus CSS `::first-letter` rather than by splitting the
  // first character into its own element: `::first-letter` keeps the sentence
  // as one uninterrupted text node, so a screen reader reads "Thank you..."
  // normally instead of announcing a stray "T" followed by "hank you".
  const thankYouLine = document.createElement('p');
  thankYouLine.className = 'closing__message closing__message--lead';
  thankYouLine.textContent = buildThankYouLine(config);
  content.appendChild(thankYouLine);

  const gardenLine = document.createElement('p');
  gardenLine.className = 'closing__message';
  gardenLine.textContent = 'We cannot wait to celebrate with you in our enchanted garden.';
  content.appendChild(gardenLine);

  // Castle pass: the user asked for a line mentioning that guests will eat
  // dinner, play games and win raffle prizes. Kept as its own sentence rather
  // than folded into the line above - three activities plus the greeting in
  // one sentence runs long, and this reads as the promise of the evening.
  //
  // Deliberately NOT config-driven, unlike the child's name: this is fixed
  // copy about what the party involves, and eventConfig.js has no field for
  // an activity list. Adding one for a single sentence used in a single place
  // would be more machinery than it earns - if the activities change, this
  // string is the one place to change.
  const activitiesLine = document.createElement('p');
  activitiesLine.className = 'closing__message';
  activitiesLine.textContent = 'There will be dinner to share, games to play, and raffle prizes to win.';
  content.appendChild(activitiesLine);

  // Castle pass 2: a gilt flourish rule between the message and the sign-off,
  // so the scroll has a visible break between "what we want to say" and "who
  // it is from" instead of five paragraphs running together. Decorative only -
  // the glyph lives in styles/entourage.css's `.closing__flourish::before`.
  const flourish = document.createElement('div');
  flourish.className = 'closing__flourish';
  flourish.setAttribute('aria-hidden', 'true');
  content.appendChild(flourish);

  const signoff = document.createElement('p');
  signoff.className = 'closing__signoff';
  signoff.textContent = 'With Love,';
  content.appendChild(signoff);

  const childName = config && config.childName != null ? String(config.childName) : '';

  const childNameLine = document.createElement('p');
  childNameLine.className = 'closing__heading';
  childNameLine.textContent = childName;
  content.appendChild(childNameLine);

  // Castle pass 2: a wax seal stamped with the child's initial, below the
  // signature - the object that actually finishes a scroll. Deep rose wax with
  // a gilt rim and an impressed monogram (styles/entourage.css).
  //
  // The initial comes from config.childName, never hardcoded, matching every
  // other name-derived string in this codebase. Rendered only when there IS a
  // name: an empty seal would read as a smudge, so a missing childName gets no
  // seal rather than a blank one.
  //
  // `aria-hidden`: the letter is a decorative impression of the name that the
  // line directly above already states, so announcing "S" after "Summer"
  // would only be noise.
  if (childName) {
    const seal = document.createElement('div');
    seal.className = 'closing__seal';
    seal.setAttribute('aria-hidden', 'true');
    seal.textContent = childName.charAt(0).toUpperCase();
    content.appendChild(seal);
  }

  // Multi-page split: RSVP is now its own page (rsvp.html) rather than a
  // scene further down the same continuous scroll - this link is how a
  // guest gets there from the end of the Details page.
  //
  // Castle pass: this is the site's RSVP button, and the user asked for it
  // to be classy - "like a button in a fairy castle". It now carries
  // `castle-button` (styles/castleOrnate.css) alongside the shared
  // `cta-button`: cast-metal ivory-to-champagne fill, gilt bevelled rim,
  // engraved gold Cinzel capitals, and small gilt flourishes flanking the
  // label. `cta-button` stays on the element because it still contributes
  // base.css's tap target and focus handling, so `castle-button` only
  // overrides the surfaces that differ.
  //
  // Exactly the same pair of classes the hero's "BEGIN THE STORY" link uses
  // (heroSection.js), so both primary buttons on the site are one object
  // rather than two lookalikes.
  const rsvpLink = document.createElement('a');
  rsvpLink.className = 'cta-button castle-button';
  rsvpLink.href = 'rsvp.html';
  rsvpLink.textContent = 'RSVP';
  content.appendChild(rsvpLink);

  scroll.appendChild(content);
  section.appendChild(scroll);

  // Attach the density-bump watcher before calling observe(), so it's
  // guaranteed to catch the reveal-class mutation regardless of which of
  // observe()'s two paths applies it (async IntersectionObserver callback, or
  // the synchronous reduced-motion revealNow() pass). Then register the
  // element for the reveal itself, after it's attached to `section` (itself
  // already in the live document), matching the timing pattern used by
  // entourageSection.js's renderEntourage().
  //
  // Both now target `scroll` rather than `content` - the reveal target moved
  // out to the scroll so the whole object animates in as one piece, and these
  // two must stay pointed at the same element: the watcher works by observing
  // the `reveal--visible` class that observe() adds, so watching a different
  // element than the one being observed would silently never fire, and the
  // closing scene's ambient particle bump would be lost.
  bumpAmbientDensityOnFirstReveal(scroll);
  observe([scroll]);
}

export default renderClosing;
