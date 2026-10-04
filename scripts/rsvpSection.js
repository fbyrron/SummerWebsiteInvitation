// rsvpSection.js
// RsvpSection component (design.md Component 6, RSVP scene).
//
// This module implements design.md's INTERFACE RsvpSection:
//
//   PROCEDURE render(config: EventConfig)
//
// render(config) builds a Luma RSVP iframe embed into #rsvp - the iframe
// is the entire page's content, with no heading or other content above
// it - clearing and rebuilding that section's content on every call, the
// same clear-and-rebuild idempotency pattern already used by
// eventDetailsSection.js's renderDetails(), entourageSection.js's
// renderEntourage(), and countdownSection.js's render().
//
// This is a real Luma RSVP form embedded directly as an iframe
// (config.rsvpEmbedUrl) - there is no button, no click-handling seam, and
// no local contact-card fallback. The iframe is the only RSVP mechanism
// WHILE the event is still upcoming. Once the event date/time has passed
// (see hasEventPassed()), the iframe is replaced entirely by a short
// farewell message, since the registration form is moot after the party.
//
// The iframe's `src` is assigned via the `.src` property (never
// innerHTML), matching this codebase's existing XSS-safety convention for
// every config-interpolated value.
//
// Requirements: 6.1

/**
 * Id of the RSVP iframe embed appended to #rsvp by render().
 */
const RSVP_EMBED_ID = 'rsvp-embed';

/**
 * Farewell copy shown in place of the iframe once the event has passed
 * (see hasEventPassed() below). The Luma RSVP form is moot after the
 * party, so the whole embed is replaced by this single warm message
 * rather than left showing a dead/closed registration form.
 */
const RSVP_OVER_MESSAGE =
  'Our fairytale celebration has come and gone \u2014 thank you for being part of Summer\u2019s magical day! \uD83D\uDC97';

/**
 * Returns true once the event date/time has passed, so render() can show
 * the farewell message instead of the (now-moot) Luma RSVP iframe.
 *
 * Parses `config.eventDate` ("YYYY-MM-DD") and `config.eventTime`
 * ("h:mm AM/PM") into a single local-time instant and compares it against
 * `Date.now()`. Uses the guest device's LOCAL time components, matching
 * the same documented single-venue assumption countdownSection.js uses
 * for its own target date (a guest in the venue's region sees the event
 * flip to "over" at the venue-local time).
 *
 * Fails SAFE: if either field is missing or unparseable, returns `false`
 * (treat as not-yet-passed), so a malformed config never hides the RSVP
 * form - the form staying up slightly too long is far less harmful than
 * hiding it when the event is still upcoming.
 *
 * @param {{eventDate?: string, eventTime?: string}} config
 * @returns {boolean}
 */
function hasEventPassed(config) {
  const dateMatch = config && typeof config.eventDate === 'string'
    ? config.eventDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    : null;
  const timeMatch = config && typeof config.eventTime === 'string'
    ? config.eventTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    : null;

  if (!dateMatch || !timeMatch) {
    return false;
  }

  const [, yearStr, monthStr, dayStr] = dateMatch;
  const [, hourStr, minuteStr, meridiem] = timeMatch;

  let hours24 = parseInt(hourStr, 10) % 12;
  if (meridiem.toUpperCase() === 'PM') {
    hours24 += 12;
  }

  const target = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
    hours24,
    parseInt(minuteStr, 10),
    0,
    0,
  );

  return Date.now() >= target.getTime();
}

/**
 * Builds the "event is over" farewell element shown in place of the
 * iframe once hasEventPassed() is true. Uses textContent (never
 * innerHTML), matching this codebase's XSS-safety convention - though the
 * string here is a static literal.
 *
 * @returns {HTMLParagraphElement}
 */
function buildEventOverMessage() {
  const message = document.createElement('p');
  message.className = 'rsvp__over-message';
  message.textContent = RSVP_OVER_MESSAGE;
  return message;
}

/**
 * Builds the Luma RSVP iframe embed element from `config.rsvpEmbedUrl`.
 *
 * Returns `null` (and appends nothing) when `rsvpEmbedUrl` is missing or
 * empty after trimming, so a missing config value never renders a
 * placeholder/broken iframe.
 *
 * @param {{rsvpEmbedUrl?: string}} config
 * @returns {HTMLIFrameElement|null}
 */
function buildRsvpEmbed(config) {
  const embedUrl = config && typeof config.rsvpEmbedUrl === 'string' ? config.rsvpEmbedUrl.trim() : '';
  if (!embedUrl) {
    return null;
  }

  const iframe = document.createElement('iframe');
  iframe.id = RSVP_EMBED_ID;
  iframe.className = 'rsvp__embed';
  iframe.src = embedUrl;
  iframe.title = 'RSVP form';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'fullscreen; payment');
  iframe.setAttribute('aria-hidden', 'false');
  iframe.setAttribute('loading', 'lazy');
  iframe.tabIndex = 0;

  return iframe;
}

/**
 * Renders the RSVP scene into #rsvp: the Luma RSVP iframe embed, with
 * nothing else on the page.
 *
 * Clears and rebuilds #rsvp's content on every call, matching the
 * clear-and-rebuild idempotency pattern used by renderDetails()
 * (eventDetailsSection.js), renderEntourage() (entourageSection.js), and
 * render() (countdownSection.js).
 *
 * @param {Object} config - EventConfig-shaped object expected to provide
 *   rsvpEmbedUrl.
 */
export function render(config) {
  const section = document.getElementById('rsvp');
  if (!section) {
    return;
  }

  // Clear any existing content before re-rendering.
  section.textContent = '';

  const content = document.createElement('div');
  content.className = 'rsvp__content';

  // Once the event has passed, the Luma RSVP form is moot - replace the
  // whole iframe with a warm farewell message instead of showing a
  // dead/closed registration form.
  if (hasEventPassed(config)) {
    content.classList.add('rsvp__content--over');
    content.appendChild(buildEventOverMessage());
    section.appendChild(content);
    return;
  }

  const embed = buildRsvpEmbed(config);
  if (embed) {
    content.appendChild(embed);
  }

  section.appendChild(content);
}

export default render;
