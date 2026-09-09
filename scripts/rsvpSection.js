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
// no local contact-card fallback. The iframe is the only RSVP mechanism.
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

  const embed = buildRsvpEmbed(config);
  if (embed) {
    content.appendChild(embed);
  }

  section.appendChild(content);
}

export default render;
