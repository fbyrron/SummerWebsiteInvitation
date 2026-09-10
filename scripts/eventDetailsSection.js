// eventDetailsSection.js
// Component 11: EventDetailsSection.
//
// -----------------------------------------------------------------------
// THIS PASS: castle-garden niches, not one plain box
// -----------------------------------------------------------------------
// The user's note: "don't put event-details__item in one box, it is so
// plain. make a style like a castle or garden of castle."
//
// So the single frosted GlassCard wrapper is gone. Each detail is now its
// own object on the page: an arched stone niche — the shape of a castle
// window — with a gilt fleur-de-lis crest at its head, an engraved label,
// and the value below it. They sit in a grid against a CSS-painted castle
// garden wall with a rose trellis (styles/eventDetails.css).
//
// Changes, and why each one:
//
//   1. GlassCard removed (no more `buildGlassCard()` import here). One card
//      holding all six fields is exactly the "one box" being objected to —
//      a card is a container, and a container's job is to make its contents
//      look like one thing. Six separate niches make each detail its own
//      thing, which is what was asked for.
//
//      No accessibility is lost: the card contributed
//      `role="region" aria-label="Event details"`, and details.html's own
//      `<section id="event-details" class="section" aria-label="Event
//      details">` already provides that exact landmark. Verified in
//      details.html.
//
//      glassCard.js and styles/glass.css are left completely untouched —
//      countdownSection.js still imports and uses them, so the shared
//      helper stays exactly as it was.
//
//   2. A section heading was added ("Party Details"). Every other scene on
//      this page has one (Princess Gallery, the countdown, the entourage);
//      this one had only the bare "01" chapter marker, which left the grid
//      of niches with nothing naming it.
//
//   3. `wide: true` on the dress-code field. Its value is a full sentence
//      while the others are a date, a time, a name, an address. In an even
//      grid that one niche would be two or three times the height of its
//      row-mates, which looks like a mistake rather than a hierarchy. It
//      now spans the full grid width instead (styles/eventDetails.css's
//      `.event-details__item--wide`), which reads as deliberate emphasis —
//      appropriate, since the dress code is the one detail guests have to
//      act on before arriving.
//
//   4. The gift note is now a parchment scroll panel rather than a loose
//      paragraph, and the map link a gated garden-path link. Both are
//      placed below the grid, where a footnote belongs.
//
// ALL field logic is unchanged from the previous version:
//
//   - DATE, TIME, VENUE, ADDRESS, DRESS CODE (config.themeNote), and RSVP
//     (config.rsvpContact) render verbatim, with no timezone conversion for
//     eventDate/eventTime (Requirements 3.1, 3.2, 3.5).
//   - The dress-code colour-swatch row (one circle per config.themeColors
//     entry, in array order) still renders directly beneath the DRESS CODE
//     value (Requirement 3.9).
//   - mapLink and giftNote each render only when present/non-empty, with no
//     placeholder content when absent (Requirements 3.6, 3.7).
//
// Uses safe DOM text insertion (textContent) exclusively, never innerHTML.
//
// Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.9

import { build as buildCameo } from './sceneCameo.js';
import { revealOnce } from './revealOnce.js';

/**
 * The detail niches, in render order. THREE now, down from five.
 *
 * -----------------------------------------------------------------------
 * MERGED: Date+Time into "When", Venue+Address into "Where"
 * -----------------------------------------------------------------------
 * The user asked for date and time in one niche, and venue and address in
 * another. They belong together: a guest does not want to know the date and
 * separately the time, they want to know WHEN, and a venue name without its
 * address is half an answer.
 *
 * So a niche is no longer one field. Each entry below has `rows` — one or
 * more config values stacked inside the same arch. That also let the labels
 * get better: "Date"/"Time"/"Venue"/"Address" were four labels stating what
 * each string is, where "When"/"Where" state what the guest is actually
 * asking.
 *
 * In `<dl>` terms this is a single `<dt>` with several `<dd>`s, which is
 * exactly what a definition list is for — one term, multiple descriptions —
 * so the semantics improved with the layout rather than being bent for it.
 *
 * Per-niche keys:
 *   `label`       the engraved heading
 *   `rows`        the config values inside, in order
 *   `wide`        span the full grid width (for sentence-length values)
 *   `withMapLink` append the "how to get there" link inside this niche
 *   `swatches`    append the dress-code colour-swatch row
 *
 * Per-row keys:
 *   `key`      the EventConfig field
 *   `format`   an optional display formatter
 *   `lead`     render larger/bolder, as the niche's primary line
 *
 * -----------------------------------------------------------------------
 * REMOVED: the RSVP niche
 * -----------------------------------------------------------------------
 * The user asked why an `event-details__item` existed for RSVP at all, and
 * whether it should be the real thing instead. It was genuinely redundant,
 * and worse than redundant: that niche rendered `config.rsvpContact`, a
 * hand-written instruction ("Text Aunt Mia at (555) 012-3456 by Aug 1")
 * containing a placeholder phone number, sitting on a site that already has
 * a working Luma RSVP form on rsvp.html. A guest reading it would have been
 * told to text a number that does not exist, while the real RSVP was one
 * button away.
 *
 * So the niche is gone and `renderDetails()` now appends a real
 * `.castle-button` RSVP link to rsvp.html in its place — the actual action,
 * where the fake instruction used to be.
 *
 * `config.rsvpContact` itself is deliberately LEFT IN eventConfig.js and
 * still validated by eventConfigValidator.js. It is no longer rendered
 * anywhere. Kept rather than deleted because it holds a real piece of
 * information the family may still want to surface (an RSVP deadline), and
 * removing a validated config field is a wider change than was asked for.
 * Flagged to the user as unrendered, so it is discoverable rather than
 * silently dead.
 *
 * -----------------------------------------------------------------------
 * MOVED: the map link
 * -----------------------------------------------------------------------
 * The user asked whether `event-details__map-link` should live in the venue
 * item. Yes — it used to sit below the whole grid, detached from the thing
 * it describes. It is now rendered inside the ADDRESS niche (`withMapLink`
 * below) rather than the Venue niche: Venue is the place's NAME, Address is
 * its location, and "how to get there" answers the location question. A
 * guest looking at the address is exactly the guest who wants the map.
 */
const DETAIL_NICHES = [
  {
    label: 'When',
    rows: [
      { key: 'eventDate', format: formatEventDateForDisplay, lead: true },
      { key: 'eventTime' },
    ],
  },
  {
    label: 'Where',
    rows: [
      { key: 'venueName', lead: true },
      { key: 'venueAddress' },
    ],
    withMapLink: true,
  },
  {
    label: 'Dress Code',
    rows: [{ key: 'themeNote' }],
    wide: true,
    swatches: true,
  },
];

// Fields that must render exactly as authored in EventConfig, with no
// timezone conversion (design.md Property 7 / Requirement 3.5). eventDate has
// its own `format` and so never reaches this path today; it is kept in the set
// so that removing that formatter would fall back to exact rendering rather
// than to a bare String() with no Date guard.
const NO_TIMEZONE_CONVERSION_FIELDS = new Set(['eventDate', 'eventTime']);

/**
 * The gilt crest glyph set at the head of every niche, like the keystone of
 * a castle window arch.
 *
 * One glyph for all six niches rather than a per-field icon, deliberately.
 * A per-field set (a clock for Time, a tower for Venue, and so on) was the
 * obvious alternative, but the glyphs that read correctly at this size are
 * scattered across Unicode blocks with uneven font coverage — a missing
 * glyph renders as a tofu box, which would look broken rather than
 * decorative. U+269C FLEUR-DE-LIS is widely available, and repeating one
 * heraldic mark across every niche reads as a matched set of castle
 * windows, which suits the request better than six mismatched pictograms.
 */
const NICHE_CREST_GLYPH = '⚜';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Formats an `eventDate`/`eventTime` value for display without ever
 * applying a timezone conversion.
 *
 * eventConfig.js documents `eventDate` as `{String|Date}`. Today the config
 * only ever supplies plain strings, so `String(value)` alone is exact. But
 * if a real `Date` instance were ever authored for `eventDate` (or
 * `eventTime`), `String(value)`/`Date.prototype.toString()` would render it
 * in the *guest's local browser timezone*, silently violating "exact as
 * authored". To guard against that regardless of how the config value is
 * produced, a `Date` instance is formatted from its UTC components instead
 * of relying on the default locale/timezone-sensitive `toString()`.
 *
 * Plain strings (the current and expected case) pass through unchanged.
 *
 * @param {*} value
 * @returns {string}
 */
function formatExactNoTimezoneValue(value) {
  if (value == null) {
    return '';
  }

  if (value instanceof Date) {
    // Use UTC getters (never local-timezone getters) so the rendered
    // date/time never drifts based on the guest device's timezone.
    const datePart = `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
    const timePart = `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
    return `${datePart} ${timePart}`;
  }

  return String(value);
}

/** Month names for the display date, index 0 = January. */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Weekday names for the display date, index 0 = Sunday (matches getUTCDay()). */
const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/**
 * Formats the event date for a human reader:
 *   "2026-10-03"  ->  "Saturday, October 3, 2026"
 *
 * -----------------------------------------------------------------------
 * WHY THIS EXISTS (answering "is 2026-10-03 better than the word October?")
 * -----------------------------------------------------------------------
 * No — not for a guest. "2026-10-03" is a machine format: it is unambiguous
 * to a parser but it makes a reader stop and decode it, and it hides the one
 * fact that decides whether someone can come at all, which is the day of the
 * week. "Saturday, October 3, 2026" answers "can I make it?" instantly.
 *
 * But `config.eventDate` CANNOT simply be rewritten to that string. Two
 * things depend on the ISO shape, and both would break:
 *   - eventConfigValidator.js validates `eventDate` against a strict
 *     /^\d{4}-\d{2}-\d{2}$/ pattern, then round-trips the parsed components
 *     to reject rollover dates like 2025-02-30. A word-form date fails that
 *     outright and the whole page would refuse to render.
 *   - countdownSection.js's parseDateOnly() reads year/month/day out of the
 *     same shape to build the countdown's target. A word-form date would
 *     throw there.
 * So the config keeps the machine format and the DISPLAY is formatted here.
 * One source of truth, no second date field to drift out of sync.
 *
 * -----------------------------------------------------------------------
 * DIVERGENCE FROM THE LITERAL REQUIREMENT (3.5 / 12.1)
 * -----------------------------------------------------------------------
 * Those requirements say the date is "displayed exactly as configured, with
 * no timezone conversion". This function formats it, so it diverges from the
 * literal wording — deliberately, and with the requirement's actual purpose
 * intact. That rule exists to stop the displayed date DRIFTING BY A DAY,
 * which is what happens when a plain date string is fed through
 * `new Date(string)` and then rendered in the viewer's local timezone.
 *
 * Nothing here can drift:
 *   - the year, month and day are pulled straight out of the string as
 *     integers by regex; the string is never handed to a date parser,
 *   - the only `Date` used is `Date.UTC(...)` purely to derive the weekday,
 *     read back with `getUTCDay()` — UTC in and UTC out, so the machine's
 *     local offset cannot affect it,
 *   - month and weekday names are looked up from fixed arrays, not from
 *     `toLocaleDateString()`, so the output does not change with the
 *     viewer's locale either.
 * A guest in Manila and a guest in Los Angeles see the same words.
 *
 * Falls back to rendering the value verbatim if it is not the expected
 * shape, so an unexpected config value degrades to the old behaviour rather
 * than to an empty niche or a mangled string.
 *
 * @param {string|Date} value
 * @returns {string}
 */
function formatEventDateForDisplay(value) {
  let year;
  let month;
  let day;

  if (value instanceof Date) {
    // eventConfig.js documents eventDate as {String|Date}. UTC getters only,
    // for the same no-drift reason formatExactNoTimezoneValue() uses them.
    if (Number.isNaN(value.getTime())) {
      return '';
    }
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else {
    const text = value != null ? String(value).trim() : '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) {
      return text;
    }
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  }

  const monthName = MONTH_NAMES[month - 1];
  if (!monthName) {
    return value != null ? String(value) : '';
  }

  // Date.UTC in, getUTCDay out — the local timezone offset never enters.
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${weekday}, ${monthName} ${day}, ${year}`;
}

/**
 * Returns true when `value` is a non-empty string once trimmed (i.e. it is
 * present and not just whitespace). Used to decide whether an optional
 * EventConfig field (mapLink, giftNote) should render at all.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isPresent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Builds the CSS-painted castle-garden backdrop the niches stand against:
 * an empty, `aria-hidden` layer whose stone wash, rose trellis lattice,
 * climbing-bloom clusters, and low hedge are all painted with CSS gradients
 * in styles/eventDetails.css.
 *
 * A single empty div rather than an image asset, matching the same
 * CSS-painted-backdrop approach already used for the landing page's garden
 * (`.hero-bg-garden`) and the gallery's castle wall (`.gallery__wall`).
 *
 * Note this deliberately reintroduces a decorative backdrop layer to this
 * scene. An earlier pass removed one as part of the site's Luma-minimal
 * restyle; the user has since asked for the opposite here, explicitly.
 *
 * @returns {HTMLDivElement}
 */
function buildGardenBackdrop() {
  const garden = document.createElement('div');
  garden.className = 'event-details__garden';
  garden.setAttribute('aria-hidden', 'true');
  return garden;
}

/**
 * Builds the "how to get there" link element for an optional `mapLink`.
 * Only called when `mapLink` has already been confirmed present
 * (Requirements 3.6, 3.7).
 *
 * Uses `.href` assignment (never innerHTML) and `textContent` for the label,
 * so no markup from the config value is ever parsed as HTML. Opens in a new
 * tab since mapLink points to an external map service.
 *
 * @param {string} mapLink
 * @returns {HTMLAnchorElement}
 */
function buildMapLinkElement(mapLink) {
  const link = document.createElement('a');
  link.className = 'event-details__map-link';
  link.href = mapLink;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'How to get there';
  return link;
}

/**
 * Builds the gift note element for an optional `giftNote`, as a parchment
 * scroll panel. Only called when `giftNote` has already been confirmed
 * present (Requirements 3.6, 3.7). Uses `textContent` exclusively, never
 * innerHTML.
 *
 * @param {string} giftNote
 * @returns {HTMLDivElement}
 */
function buildGiftNoteElement(giftNote) {
  const scroll = document.createElement('div');
  scroll.className = 'event-details__gift-scroll';

  const note = document.createElement('p');
  note.className = 'event-details__gift-note';
  note.textContent = giftNote;
  scroll.appendChild(note);

  return scroll;
}

/**
 * Builds the dress-code colour-swatch row: one small filled circle per
 * entry in `themeColors`, in array order (Requirement 3.9).
 * Presentation-only — no validation is performed here, since each entry is
 * already a validated hex string per the EventConfig schema (Requirement
 * 12.2). Reinforces the DRESS CODE text visually; does not replace it, so
 * the row is marked `aria-hidden="true"` (the dress-code instruction itself
 * is already announced via the preceding `<dd>` text).
 *
 * Each swatch's `background-color` is set inline (never via a fixed CSS
 * class value), since these are per-instance dynamic colours read straight
 * from `config.themeColors` — the shared circle shape/size/border comes
 * from `.event-details__swatch` in styles/eventDetails.css.
 *
 * @param {string[]} themeColors
 * @returns {HTMLDivElement}
 */
function buildDressCodeSwatchRow(themeColors) {
  const row = document.createElement('div');
  row.className = 'event-details__swatch-row';
  row.setAttribute('aria-hidden', 'true');

  themeColors.forEach((hex) => {
    const swatch = document.createElement('span');
    swatch.className = 'event-details__swatch';
    swatch.style.backgroundColor = String(hex);
    row.appendChild(swatch);
  });

  return row;
}

/**
 * Builds one arched niche: the gilt crest keystone, the engraved label, the
 * value, and — for the dress-code field only — the colour-swatch row.
 *
 * Stays a `<div>` wrapping a `<dt>` and `<dd>` inside the parent `<dl>`,
 * which is valid HTML and is exactly the structure this module used before,
 * so the definition-list semantics screen readers rely on are unchanged.
 * The crest is a `<span aria-hidden="true">` placed before the `<dt>`;
 * `<dl>` permits it inside the wrapping div and it is invisible to
 * assistive technology, so it does not disturb the term/description pairing.
 *
 * @param {{key: string, format?: Function, lead?: boolean}} row
 * @param {Object} config
 * @returns {HTMLElement} a `<dd>`
 */
function buildNicheRow({ key, format, lead }, config) {
  const value = config ? config[key] : undefined;

  const dd = document.createElement('dd');
  dd.className = lead
    ? 'event-details__value event-details__value--lead'
    : 'event-details__value';

  if (format) {
    // Currently only eventDate, which is reshaped from the config's machine
    // format into a readable one - see formatEventDateForDisplay() for why
    // that is a deliberate, drift-free divergence from Requirement 3.5's
    // literal "exactly as configured" wording.
    dd.textContent = format(value);
  } else if (NO_TIMEZONE_CONVERSION_FIELDS.has(key)) {
    // eventTime: displayed exactly as authored, via the defensive Date-safe
    // formatter (Requirement 3.5).
    dd.textContent = formatExactNoTimezoneValue(value);
  } else {
    // Every other field is always a plain string, so String(value) is exact.
    dd.textContent = value != null ? String(value) : '';
  }

  return dd;
}

/**
 * @param {{label: string, rows: Array, wide?: boolean, withMapLink?: boolean, swatches?: boolean}} niche
 * @param {Object} config
 * @returns {HTMLDivElement}
 */
function buildNiche({ label, rows, wide, withMapLink, swatches }, config) {
  const item = document.createElement('div');
  item.className = wide
    ? 'event-details__item event-details__item--wide'
    : 'event-details__item';

  const crest = document.createElement('span');
  crest.className = 'event-details__crest';
  crest.setAttribute('aria-hidden', 'true');
  crest.textContent = NICHE_CREST_GLYPH;
  item.appendChild(crest);

  const dt = document.createElement('dt');
  dt.className = 'event-details__label';
  dt.textContent = label;
  item.appendChild(dt);

  // One `<dt>` followed by several `<dd>`s - a single term with multiple
  // descriptions, which is what a definition list is actually for. So merging
  // Date+Time and Venue+Address improved the semantics rather than bending
  // them: "When" genuinely has two descriptions.
  rows.forEach((row) => {
    item.appendChild(buildNicheRow(row, config));
  });

  // The dress-code swatch row goes directly after the dress-code value,
  // inside this same niche - a row of circles "beneath the themeNote text",
  // not a wholly separate <dl> entry.
  if (swatches) {
    const themeColors = config ? config.themeColors : undefined;
    if (Array.isArray(themeColors) && themeColors.length > 0) {
      item.appendChild(buildDressCodeSwatchRow(themeColors));
    }
  }

  // The "how to get there" link lives INSIDE the "Where" niche rather than
  // detached below the whole grid - see DETAIL_NICHES' header comment. Still
  // conditional: appended only when config.mapLink is present and non-empty,
  // with no placeholder when absent (Requirements 3.6, 3.7).
  if (withMapLink) {
    const mapLink = config ? config.mapLink : undefined;
    if (isPresent(mapLink)) {
      item.appendChild(buildMapLinkElement(mapLink.trim()));
    }
  }

  return item;
}

/**
 * Builds the real RSVP action: a `.castle-button` link to rsvp.html, where
 * the working Luma RSVP form lives.
 *
 * This is what replaced the removed RSVP niche — see DETAIL_FIELDS' header
 * comment for the full reasoning. The short version: that niche printed a
 * hand-written instruction with a placeholder phone number while a real RSVP
 * form sat one page away. This is the real thing, in the same position.
 *
 * Carries the same `cta-button castle-button` pair as the hero's CTA and the
 * closing scene's RSVP link (styles/castleOrnate.css), so all three primary
 * buttons on the site are one object.
 *
 * Note the closing scene at the bottom of this page also ends with an RSVP
 * button. That is intentional and is NOT the redundancy that was flagged: a
 * primary action offered both where a guest is reading the details and again
 * at the end of the page is normal, whereas the removed niche was fake
 * instructions competing with a real system.
 *
 * @returns {HTMLAnchorElement}
 */
function buildRsvpAction() {
  const link = document.createElement('a');
  link.className = 'cta-button castle-button event-details__rsvp';
  link.href = 'rsvp.html';
  link.textContent = 'RSVP';
  return link;
}

/**
 * Renders the event detail fields into the #event-details section as a grid
 * of arched castle-garden niches.
 *
 * Structure built:
 *
 *   #event-details
 *     .event-details__garden      CSS-painted stone + rose trellis backdrop
 *     .event-details__content
 *       p.section-number          "01" chapter marker
 *       h2.event-details__heading "Party Details"
 *       dl.event-details__niches
 *         .event-details__item x3   crest + label + one or more values
 *                                   "When"  = date + time
 *                                   "Where" = venue + address + map link
 *                                   "Dress Code" = note + colour swatches
 *       a.event-details__rsvp       the real RSVP button -> rsvp.html
 *       .event-details__gift-scroll only when config.giftNote is present
 *
 * Values are displayed exactly as provided on the config object - no date
 * formatting, no timezone conversion, no truncation.
 *
 * Clears and rebuilds the section's content on every call, matching the
 * clear-and-rebuild idempotency pattern used across this codebase.
 *
 * @param {Object} config - EventConfig-shaped object expected to provide
 *   eventDate, eventTime, venueName, venueAddress, themeNote, themeColors,
 *   rsvpContact, and optionally mapLink/giftNote.
 */
export function renderDetails(config) {
  const section = document.getElementById('event-details');
  if (!section) {
    return;
  }

  // Clear any existing content before re-rendering.
  section.textContent = '';

  section.appendChild(buildGardenBackdrop());

  const content = document.createElement('div');
  content.className = 'event-details__content';

  // Gilt oval cameo of Summer, heading this scene, at the larger 'large' size
  // (the user asked the event-details and entourage cameos to be bigger).
  // Decorative - see scripts/sceneCameo.js for why it carries empty alt text.
  // The photo is a static asset reference, not config data, matching
  // gallerySection.js's treatment of its own portraits.
  content.appendChild(buildCameo({
    src: 'assets/summer-photos/04a7fc0e-e895-4d6d-a7d7-6adc9c6dfcc3.jpg',
    variant: 'large',
  }));

  // Quiet numbered chapter marker ("01"), matching the editorial
  // numbered-section convention shared with entourageSection.js ("02") and
  // closingSection.js ("03"). Styled by `.section-number` - base.css for the
  // shared rule, styles/detailsOrnate.css for this page's storybook
  // override.
  const sectionNumber = document.createElement('p');
  sectionNumber.className = 'section-number';
  sectionNumber.textContent = '01';
  content.appendChild(sectionNumber);

  const heading = document.createElement('h2');
  heading.className = 'event-details__heading';
  heading.textContent = 'Party Details';
  content.appendChild(heading);

  const list = document.createElement('dl');
  list.className = 'event-details__niches';

  const niches = DETAIL_NICHES.map((niche) => {
    const item = buildNiche(niche, config);
    list.appendChild(item);
    return item;
  });

  content.appendChild(list);

  // Sway on view: revealOnce() adds `.is-in-view` to each niche the first time
  // it scrolls into frame, and styles/eventDetails.css gates the finite sway
  // animation on that class - so each niche swings briefly from its crest when
  // you reach it, then rests. See scripts/revealOnce.js for why this is a
  // separate, narrower helper than scrollRevealController.js.
  revealOnce(niches);

  // The real RSVP action, where the removed RSVP niche used to be.
  content.appendChild(buildRsvpAction());

  // The map link is no longer appended here - it now renders inside the
  // Address niche (see DETAIL_FIELDS and buildNiche()).

  // Conditional optional field. Appended only when present and non-empty
  // (trimmed) - otherwise no node is added at all, per Requirements 3.6 and
  // 3.7 (no placeholder/blank content).
  const giftNote = config ? config.giftNote : undefined;
  if (isPresent(giftNote)) {
    const giftScroll = buildGiftNoteElement(giftNote.trim());
    content.appendChild(giftScroll);
    // Unfurl on view: same one-time trigger as the niches above. revealOnce()
    // adds `.is-in-view` the first time the scroll enters frame, and
    // styles/eventDetails.css opens it from a rolled-shut band to full height
    // and fades the note in - mirroring the closing scene's scroll.
    revealOnce([giftScroll]);
  }

  section.appendChild(content);
}

export default renderDetails;
