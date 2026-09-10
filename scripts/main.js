// main.js
// Application entry point (design.md's "Page load" sequence diagram /
// "Example Usage" pseudocode; task 20).
//
// Full rewrite of the task-1 stub: that version only rendered the four
// sections that existed at the time (Hero, EventDetails, Entourage,
// Closing) and imported heroSection.js's OLD function names
// (renderHeadline/playHeadlineAnimation/renderCallToAction/
// renderDecorativeFlourishes/ensureDecorativeFontOrFallback as
// standalone exports), all of which were renamed/removed by task 11's
// rewrite (heroSection.js now exports a single composed `render(config)`).
// This file now wires all seven scenes plus every cross-cutting
// controller added since that stub was written (ScrollRevealController,
// ParallaxController, FontLoader, AmbientParticleField).
//
// Flow (unchanged from the stub for steps 1-2, per Requirements 12.2/12.3/
// 12.4):
//   1. loadEventConfig() - on failure (ConfigLoadError), report and STOP.
//   2. validateEventConfig(config) - on failure, report and STOP.
//   3. Call every section's render function once, in the same fixed
//      order: Hero, Gallery, EventDetails, Entourage, Countdown, Rsvp,
//      Closing.
//   4. Init the cross-cutting controllers: AmbientParticleField,
//      ParallaxController, FontLoader (ScrollRevealController is
//      deliberately NOT called here - see the divergence note below).
//
// --------------------------------------------------------------------
// Multi-page split (index.html / details.html / rsvp.html)
// --------------------------------------------------------------------
// The site is no longer one continuous single-page scroll - it is now
// three separate real HTML pages: index.html (Hero only, the landing
// page), details.html (Gallery, EventDetails, Entourage, Countdown,
// Closing), and rsvp.html (Rsvp only). This SAME main.js file is loaded,
// completely unchanged, by all three pages - there is no per-page branch
// or separate entry script anywhere in this file.
//
// That works because every section render function
// (renderHero/renderGallery/renderDetails/renderEntourage/
// renderCountdown/renderRsvp/renderClosing) already starts with its own
// `document.getElementById('<id>'); if (!section) { return; }` guard (see
// each module's own source). Calling all seven render functions on every
// page is therefore always safe: on a page where a given section's
// element isn't declared in the HTML, that section's render call is a
// silent no-op, and only the sections whose elements ARE present on the
// current page actually render anything.
//
// Step 3-4 is wrapped in a try/catch so an unexpected exception doesn't
// leave the page half-rendered without at least a console error to aid
// debugging - config-loading/validation failures already have their own
// explicit handling in steps 1-2 and must not fall through to this catch.
//
// --------------------------------------------------------------------
// Documented divergence from design.md's "Example Usage" pseudocode
// --------------------------------------------------------------------
// design.md's pseudocode calls `scrollRevealController.observe(
// collectRevealTargets())` centrally, here in main.js, and also shows
// main.js wiring the hero "BEGIN THE STORY" button's onClick. Re-reading
// every section module actually built in tasks 11-17 (not just the
// pseudocode) shows the real implementation pushed both of those
// responsibilities into the sections themselves instead of centralizing
// them here:
//
//   - ScrollRevealController.observe(): heroSection.js's
//     renderDecorativeFlourishes(), gallerySection.js's render(),
//     entourageSection.js's renderEntourage(), and closingSection.js's
//     renderClosing() each call `observe()` themselves, directly, on
//     their own `data-reveal-direction` elements, immediately after
//     inserting them into the document. Cross-checked every module for
//     any element carrying `data-reveal-direction` anywhere in this
//     codebase (grep confirms the only occurrences are in those four
//     files): eventDetailsSection.js's floral backdrop, countdownSection.js,
//     and rsvpSection.js never set `data-reveal-direction` on anything, so
//     there is nothing left for main.js to collect and observe - a second,
//     central `observe()` pass here would either do nothing (no
//     unobserved elements exist) or double-observe elements that already
//     got `observe()` called on them, which is redundant, not harmful,
//     but still worth avoiding. So main.js intentionally does NOT call
//     `ScrollRevealController.observe()` at all.
//   - Hero "BEGIN THE STORY" click: heroSection.js's
//     renderCallToAction() attaches its own `click` listener directly
//     (a plain `scrollIntoView('gallery', ...)` call) when it builds the
//     button. Confirmed by reading that function - main.js does not
//     attach a second listener.
//
// rsvpSection.js's render(config) has no click-handling seam at all - it
// just builds a static Luma RSVP iframe embed (config.rsvpEmbedUrl) into
// #rsvp. There is no button and no local fallback to wire.
//
// This file's real remaining job is therefore narrower than the
// pseudocode implies: render all seven sections with their current
// exports, and initialize the three controllers that did not exist (or
// were not yet wired) when the task-1 stub was written -
// AmbientParticleField, ParallaxController, and FontLoader.
//
// This file is loaded as `<script type="module">` on all three pages, so
// it runs once as a deferred module script on each - after that page's
// document has been parsed. Which of the section/parallax elements are
// actually present by the time this module's top-level code runs varies
// per page: index.html only declares `#app`/`#hero`/`#parallax-bg`/
// `#parallax-mid`/`#parallax-fg`; details.html declares `#app`/
// `#gallery`/`#event-details`/`#entourage`/`#countdown`/`#closing`/the
// same three parallax layers; rsvp.html declares only `#app`/`#rsvp`
// (no parallax layers). No DOMContentLoaded listener is needed on any of
// them (module scripts are deferred by default), and no per-page branch
// is needed either, per the guard-based no-op behavior described above.
//
// Uses no innerHTML/unsafe DOM APIs itself - this file is pure
// wiring/orchestration; every actual DOM write happens inside the section
// modules it calls.

import { loadEventConfig } from './configLoader.js';
import { validateEventConfig } from './eventConfigValidator.js';
import { reportConfigError } from './configErrorReporter.js';
import { render as renderHero } from './heroSection.js';
import { render as renderGallery } from './gallerySection.js';
import { renderDetails } from './eventDetailsSection.js';
import { renderEntourage } from './entourageSection.js';
import { render as renderCountdown } from './countdownSection.js';
import { render as renderRsvp } from './rsvpSection.js';
import { renderClosing } from './closingSection.js';
import { initSparkleBackground } from './sparkleBackground.js';
import { init as initParallax } from './parallaxController.js';
import { ensureFontsOrFallback } from './fontLoader.js';
import { initFairyTransition } from './fairyTransition.js';

/**
 * Speed fractions for the three static parallax backdrop layers declared
 * in index.html (`#parallax-bg`/`#parallax-mid`/`#parallax-fg`), per
 * design.md's Overview: slow background branches, mid-layer petals,
 * faster foreground sparkles.
 */
const BACKGROUND_LAYER_SPEED = 0.08;
const MID_LAYER_SPEED = 0.18;
const FOREGROUND_LAYER_SPEED = 0.3;

/**
 * Collects the `{element, speed}` pairs `ParallaxController.init()`
 * expects: the three static layers (`#parallax-bg`/`#parallax-mid`/
 * `#parallax-fg`). These are declared in index.html and details.html but
 * NOT in rsvp.html (see the multi-page split note at the top of this
 * file), so any layer element that isn't found in the current page's DOM
 * is simply omitted rather than passed as a null element - on rsvp.html
 * this resolves to an empty array, which `initParallax()` already
 * handles safely.
 *
 * @returns {Array<{element: Element, speed: number}>}
 */
function collectParallaxLayers() {
  return [
    { element: document.getElementById('parallax-bg'), speed: BACKGROUND_LAYER_SPEED },
    { element: document.getElementById('parallax-mid'), speed: MID_LAYER_SPEED },
    { element: document.getElementById('parallax-fg'), speed: FOREGROUND_LAYER_SPEED },
  ].filter((layer) => layer.element != null);
}

async function main() {
  let config;

  // Step 1 (Requirement 12.3): config-source-load-failure. Must be checked,
  // and reported, before any field-level validation is attempted.
  try {
    config = await loadEventConfig();
  } catch (error) {
    reportConfigError(error);
    return;
  }

  // Step 2 (Requirement 12.2/12.4): field-validation-failure, distinct from
  // step 1's load failure.
  const validation = validateEventConfig(config);
  if (!validation.valid) {
    reportConfigError(validation);
    return;
  }

  // Step 3-4: normal rendering + controller init. Wrapped so an unexpected
  // error here is at least observable via console.error, rather than
  // leaving the page in a silent, half-rendered state.
  try {
    // Ambient sparkle background (AmbientParticleField): purely
    // decorative, doesn't depend on `config` at all, so it's wired in
    // alongside the other rendering calls here rather than needing its
    // own separate step.
    initSparkleBackground();

    // All seven section render calls, every time, on every page - see the
    // multi-page split note at the top of this file for why that's safe:
    // each call is a no-op on a page whose HTML doesn't declare that
    // section's element. Gallery takes no config per its own documented
    // interface.
    renderHero(config);
    renderGallery();
    renderDetails(config);
    renderEntourage(config);
    renderCountdown(config);
    renderRsvp(config);
    renderClosing(config);

    // ParallaxController: collectParallaxLayers() only finds the three
    // static layers, which are absent on rsvp.html - see that function's
    // own docstring above.
    initParallax(collectParallaxLayers());

    // FontLoader: a progressive-enhancement font upgrade, not a rendering
    // blocker - not awaited, matching the task-1 stub's same
    // "fire and forget" treatment of the prior single-font
    // ensureDecorativeFontOrFallback() call, so a slow/failed font load
    // never delays the rest of this function.
    ensureFontsOrFallback();

    // Fairy cross-page transition. On browsers that support cross-document
    // View Transitions, tags <html data-vt-ready> so the soft champagne
    // dissolve declared in base.css plays as the browser navigates between
    // pages (the browser owns the whole motion, so nothing can be left frozen
    // on a bfcache back-restore - the bug the old overlay had). Also registers
    // a pageshow/bfcache backstop. A no-op where the API is absent or motion is
    // reduced (pages just cut over). Safe to call on every page - see
    // fairyTransition.js's own docstring.
    initFairyTransition();

    // ScrollRevealController.observe() is intentionally NOT called here -
    // see the "Documented divergence" note at the top of this file: every
    // element that carries data-reveal-direction is already registered by
    // its own section's render call above.

    // Hero's "BEGIN THE STORY" CTA is also intentionally NOT wired here -
    // see the same divergence note: heroSection.js's renderCallToAction()
    // attaches its own click listener already, as part of the
    // renderHero() call above. rsvpSection.js's render(config) has no
    // click-handling seam to wire at all - it only renders a static
    // iframe embed.
  } catch (error) {
    console.error('Failed to initialize the invitation page:', error);
  }
}

main();
