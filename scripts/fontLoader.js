// fontLoader.js
// FontLoader component (design.md Component 2).
// Generalizes heroSection.js's existing single-font
// ensureDecorativeFontOrFallback()/loadDecorativeFontWithTimeout() pattern
// (Requirement 1.5) to cover both webfonts used by the redesign: Playfair
// Display (headings) and Poppins (body/UI). Each family is raced against
// its own timer sharing the same timeoutMs, so a slow/failed load of one
// family never blocks or delays the other's resolution (Requirement 11.3).
//
// This module is intentionally standalone rather than folded into
// heroSection.js: heroSection.js is fully rewritten in task 11.x and its
// own ensureDecorativeFontOrFallback() is left untouched until then.

/** Requirement 1.5: 3000ms load timeout before falling back to a standard
 * font. Named to mirror heroSection.js's DECORATIVE_FONT_TIMEOUT_MS, whose
 * value (3000) this constant matches. */
export const FONT_LOAD_TIMEOUT_MS = 3000;

/**
 * CSS class applied to `.headline` elements when Playfair Display fails to
 * load in time. Reuses the exact class name/convention already defined in
 * styles/base.css and used by heroSection.js's decorative-font fallback,
 * so no new CSS rule is needed for this family.
 */
const HEADING_FALLBACK_CLASS = 'headline--fallback-font';

/**
 * CSS class applied when Poppins fails to load in time.
 *
 * Target/selector decision: no Poppins-consuming component exists yet to
 * dictate a narrower target (e.g. a specific card or section), so this
 * class is applied to `document.body` - the single element that already
 * carries `font-family: var(--font-body)` in styles/base.css, and the
 * broadest reasonable target since Poppins is the primary body/UI font
 * for the whole page, not just one section. A future component-specific
 * fallback (mirroring `.headline--fallback-font`'s narrower scope) can be
 * layered on later without changing this module's contract.
 *
 * `.body-font--fallback` is not yet declared in styles/base.css; until a
 * later task adds a rule for it, applying the class is a documented no-op
 * visually (Poppins' fallback stack in `--font-body` already ends in
 * system sans-serif fonts, so the page still renders correctly either
 * way - this class exists so a future CSS rule has a deterministic hook
 * to attach to, matching the heading fallback's pattern).
 */
const BODY_FALLBACK_CLASS = 'body-font--fallback';

/** Font family name/target pairs raced by ensureFontsOrFallback(). */
const FONT_FAMILIES = [
  { family: 'Playfair Display', fallbackClass: HEADING_FALLBACK_CLASS },
  { family: 'Poppins', fallbackClass: BODY_FALLBACK_CLASS },
];

/**
 * Races `document.fonts.load(...)` for a single font family against a
 * `timeoutMs` timer, resolving `true` if the font finishes loading first
 * and `false` on timeout or on a rejected load. Never rejects - failure is
 * always reported as a resolved `false`, matching the pattern
 * heroSection.js's `loadDecorativeFontWithTimeout` already uses.
 *
 * @param {string} family
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function loadFontWithTimeout(family, timeoutMs) {
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

    document.fonts.load(`1em "${family}"`).then(
      () => finish(true),
      () => finish(false),
    );
  });
}

/**
 * Waits up to `timeoutMs` for both Playfair Display and Poppins to load,
 * using the CSS Font Loading API (`document.fonts`, a `FontFaceSet`).
 * Requirement 1.5 / 11.3 (design.md Component 2 / Error Scenario 2): each
 * family races its own timer independently against the same shared
 * `timeoutMs` value, so one family timing out does not delay or block the
 * other's fallback (or success) from being applied as soon as it settles.
 *
 * On a given family's timeout or rejected load, applies that family's own
 * fallback class (see `FONT_FAMILIES` above) - never the other family's.
 * If a family loads in time, no action is needed for it: the CSS variable
 * already referencing that family (`--font-heading`/`--font-body`) picks
 * it up once it's ready.
 *
 * Guards against non-browser environments and browsers without the Font
 * Loading API (no `document`/`document.fonts`): in that case neither
 * family's load can be verified, so this resolves immediately without
 * forcing any fallback, letting the CSS fallback stacks in base.css
 * behave naturally instead - same guard heroSection.js's
 * `ensureDecorativeFontOrFallback` already uses.
 *
 * Never rejects.
 *
 * @param {number} [timeoutMs] Optional override for the shared load
 *   timeout, in milliseconds. Defaults to `FONT_LOAD_TIMEOUT_MS` (3000ms
 *   per Requirement 1.5). Exposed as a parameter purely so unit tests can
 *   pass a short timeout instead of waiting out the real 3000ms;
 *   production callers should omit it and rely on the default.
 * @returns {Promise<void>}
 */
export async function ensureFontsOrFallback(timeoutMs = FONT_LOAD_TIMEOUT_MS) {
  if (typeof document === 'undefined' || !document.fonts) {
    return;
  }

  // Each family gets its own independent load-or-fallback pipeline; running
  // them via Promise.all still lets each settle (and apply its fallback)
  // as soon as ITS OWN timer/load resolves, since neither pipeline awaits
  // the other internally - Promise.all here only waits for both handlers
  // to finish being applied, it does not couple their individual timing.
  await Promise.all(
    FONT_FAMILIES.map(async ({ family, fallbackClass }) => {
      const loaded = await loadFontWithTimeout(family, timeoutMs);
      if (loaded) {
        return;
      }

      if (fallbackClass === HEADING_FALLBACK_CLASS) {
        const headline = document.querySelector('.headline');
        if (headline) {
          headline.classList.add(fallbackClass);
        }
        return;
      }

      if (document.body) {
        document.body.classList.add(fallbackClass);
      }
    }),
  );
}

// Exported for unit testing (Task 5.2) and reuse.
export { HEADING_FALLBACK_CLASS, BODY_FALLBACK_CLASS };
