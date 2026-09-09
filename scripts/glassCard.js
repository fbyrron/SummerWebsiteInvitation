// glassCard.js
// GlassCard shared helper (design.md Component 8, Task 10.2).
// One shared "luxury floating glassmorphism card" builder, used by
// EventDetailsSection, CountdownSection, and RsvpSection's contact card
// (tasks 13/15/16), so the frosted-glass look, gold border, and rounded
// corners stay visually consistent across all three without three separate
// implementations.
//
// Visual styling (backdrop-filter blur, translucent tint, gold border,
// the @supports not (backdrop-filter: blur(1px)) readability fallback) all
// live in styles/glass.css - this module only builds the DOM structure and
// its ARIA wiring, per this project's existing separation between markup/
// behavior (JS) and appearance (CSS).

/** Base class applied to every GlassCard's outer element. */
const GLASS_CARD_CLASS = 'glass-card';

/** Class applied to the inner content container callers append into. */
const GLASS_CARD_BODY_CLASS = 'glass-card__body';

/**
 * Builds one GlassCard: a frosted-glass card landmark plus an inner body
 * container for callers to append their own content into.
 *
 * ARIA choice (documented per design.md's "your call" note): the outer
 * card is given `role="region"` plus `aria-label="{ariaLabel}"`, since each
 * GlassCard usage in this design (event details, countdown, RSVP contact)
 * is a distinct, meaningful block of page content a screen-reader user may
 * want to jump to directly - exactly what the "region" landmark role is
 * for. `tabindex="-1"` makes the card programmatically focusable (e.g. so
 * RsvpSection.revealContactCard() can move focus to it alongside its
 * smooth-scroll) without inserting it into the natural Tab order, which
 * would otherwise force keyboard users to tab through a non-interactive
 * container on every visit. Requirement 10.3 only requires the "BEGIN THE
 * STORY"/"RSVP NOW" *buttons* to be Tab-reachable; those remain native
 * `<button>` elements elsewhere and are unaffected by this choice.
 *
 * Uses `createElement`/`setAttribute`/`className` only (never `innerHTML`),
 * matching this codebase's existing XSS-safety convention.
 *
 * @param {{ariaLabel: string}} options
 * @returns {{card: Element, body: Element}}
 */
export function build(options) {
  const { ariaLabel } = options || {};

  const card = document.createElement('div');
  card.className = GLASS_CARD_CLASS;
  card.setAttribute('role', 'region');
  if (ariaLabel) {
    card.setAttribute('aria-label', ariaLabel);
  }
  card.setAttribute('tabindex', '-1');

  const body = document.createElement('div');
  body.className = GLASS_CARD_BODY_CLASS;

  card.appendChild(body);

  return { card, body };
}
