// entourageSection.js
// EntourageSection component (design.md Component 12). Renders the
// symbol-bearer groups between EventDetailsSection and Closing, following
// the same clear-and-rebuild idempotency pattern as renderDetails() in
// eventDetailsSection.js.
//
// -----------------------------------------------------------------------
// THIS PASS: correct heading, one frame per group
// -----------------------------------------------------------------------
// Two user notes, both addressed here.
//
// 1. "'The Royal Entourage' — I don't think this term is correct."
//    Agreed, and it was wrong twice over. "Entourage" is the term for a
//    WEDDING party (or a debut's court) — a bridal entourage, groomsmen,
//    bridesmaids. This is a 7th birthday, and the groups in
//    eventConfig.js are 7 Roses, 7 Candles, 7 Wishes, 7 Shoes, 7 Pajamas,
//    7 Blind Box: these are the Filipino seventh-birthday tradition where
//    seven people present each of seven symbolic gifts. The recognised
//    name for that is the SEVEN SYMBOLS (sometimes "7 Symbols" or
//    "symbolic gifts"), not an entourage. "Royal" also over-claimed —
//    these are aunts, uncles, grandparents and friends, not a court.
//
//    The heading is now "The Seven Symbols". Left as a judgement call
//    flagged to the user, since it is their family's celebration and
//    "Seven Blessings" or "Seven Treasures" are equally common on
//    invitations for the same tradition.
//
//    NOTE the CSS class names, the section id (`#entourage`), and this
//    module's own filename are all deliberately UNCHANGED. Renaming them
//    would touch details.html, entourage.css, main.js and design.md for a
//    purely cosmetic gain, and `config.entourage` is the config key that
//    holds this data. Only the words a guest actually reads changed.
//
// 2. "Each entourage__group reveal--visible should be on a different box
//    or frame."
//    Each group is now its own framed panel (styles/entourage.css) instead
//    of a stop on one shared vertical timeline. That is what the vertical
//    connecting line was working against: a single line running through all
//    six groups is a statement that they are one continuous sequence, so
//    revealing them one at a time read as a line being drawn rather than as
//    six separate things arriving.
//
//    Consequently REMOVED: the central connecting line, the per-group
//    timeline marker dot, and `buildTimelineDividerElement()` /
//    `.entourage__divider` (the sparkle glyph between consecutive stops).
//    A divider's whole job is separating items in one continuous run;
//    six discrete framed panels in a grid separate themselves.
//
//    The marker is replaced by a gilt crest on each panel's own header
//    plaque, so each panel is self-contained.
//
// Data-rendering logic is unchanged: the full `config.entourage` dataset
// (6 groups / 49 names today, never shortened), rendered with
// textContent only.
//
// Decision log carried forward from the earlier redesign pass:
//   - The old "SUMMER@7"-style pill tag (buildNameAgeTag() /
//     .entourage__tag) stays removed.
//   - The old "Continue" click-to-advance button (`.section-next-btn`)
//     stays removed - main.js has no handler for it.
//   - The `.section-number` "02" label stays, per this codebase's
//     numbered-section convention.
//
// All config-provided text (role names, member names) is inserted via
// textContent/createElement only, never innerHTML - these are real
// people's names from user-provided config, so this codebase's existing
// XSS-safety convention applies here too.
//
// Redesign pass (task 14, design.md Component 12): the data-rendering
// logic is unchanged from the prior plain-list presentation - full
// `config.entourage` dataset (6 groups / 49 names today, never
// shortened), `textContent`-only rendering for role names and member
// names. Only the *presentation* changes: groups are now laid out as a
// vertical timeline with a central gold connecting line (styles/
// entourage.css) and floral dividers between groups, and each group is
// registered as its own `fade-up` ScrollRevealController target (task
// 14.2) so groups animate in one at a time as the guest scrolls, rather
// than all six appearing at once.
//
// Decision log (documented per task instructions, since design.md's
// Component 12 doesn't mention these two elements at all for the new
// design):
//   - REMOVED the old "SUMMER@7"-style pill tag (buildNameAgeTag() /
//     .entourage__tag). It was a leftover from the prior plain-list
//     design and doesn't fit the "vertical timeline titled 'The Royal
//     Entourage'" visual language - keeping it would compete with the
//     timeline as the primary structure for no benefit design.md asks for.
//   - REMOVED the "Continue" button (the old `.section-next-btn`
//     click-to-advance affordance). Task 1 already removed the
//     `.section-next-btn` delegated handler from main.js, so this button
//     would now be dead/non-functional UI if left in place. Guests simply
//     scroll to the next scene.
//   - KEPT the `.section-number` "02" label - it's still a valid quiet
//     editorial marker per this codebase's numbered-section convention
//     and doesn't conflict with the timeline presentation.
//
// All config-provided text (role names, member names) is inserted via
// textContent/createElement only, never innerHTML - these are real names
// (user-provided config content), so this codebase's existing XSS-safety
// convention (see renderHeadline()/renderDetails()) applies here too.

import { observe } from './scrollRevealController.js';
import { build as buildCameo } from './sceneCameo.js';

/**
 * The gilt crest glyph set on each panel's header plaque. U+269C
 * FLEUR-DE-LIS, the same heraldic mark used on the event-details niches
 * (eventDetailsSection.js's NICHE_CREST_GLYPH), so the two scenes read as
 * the same building. Chosen for the same reason: wide font coverage, where
 * a more specific pictogram risks rendering as a tofu box.
 */
const GROUP_CREST_GLYPH = '⚜';

/**
 * Builds one symbol group as its own self-contained framed panel: a header
 * plaque carrying a gilt crest and the group's name ("7 Roses"), and the
 * list of the seven people who present it.
 *
 * Uses textContent exclusively for the group name and every member name -
 * unchanged from every prior version.
 *
 * Registers the returned element with `data-reveal-direction="fade-up"` so
 * `ScrollRevealController.observe()` can pick it up as its own independent
 * reveal target; the caller (renderEntourage) calls `observe()` with the
 * full set once they are all built. That per-group reveal is the whole
 * reason each group needed to become its own frame — see this module's
 * header, point 2.
 *
 * The crest is a `<span aria-hidden="true">` rather than the old absolutely
 * positioned timeline dot, so it belongs to this panel instead of to a
 * shared line running behind all of them.
 *
 * @param {{role: string, members: string[]}} group
 * @returns {HTMLDivElement}
 */
function buildRoleGroupElement(group) {
  const wrapper = document.createElement('div');
  wrapper.className = 'entourage__group';
  wrapper.setAttribute('data-reveal-direction', 'fade-up');

  // Header plaque: the crest and the group name together, so the name sits
  // on its own cast band across the top of the panel rather than floating
  // above the list.
  const plaque = document.createElement('div');
  plaque.className = 'entourage__plaque';

  const crest = document.createElement('span');
  crest.className = 'entourage__crest';
  crest.setAttribute('aria-hidden', 'true');
  crest.textContent = GROUP_CREST_GLYPH;
  plaque.appendChild(crest);

  const roleHeading = document.createElement('h3');
  roleHeading.className = 'entourage__role';
  roleHeading.textContent = group && group.role != null ? String(group.role) : '';
  plaque.appendChild(roleHeading);

  wrapper.appendChild(plaque);

  const list = document.createElement('ul');
  list.className = 'entourage__members';

  const members = group && Array.isArray(group.members) ? group.members : [];
  members.forEach((member) => {
    const item = document.createElement('li');
    item.className = 'entourage__member';
    item.textContent = member != null ? String(member) : '';
    list.appendChild(item);
  });

  wrapper.appendChild(list);
  return wrapper;
}

/**
 * Renders the entourage section into #entourage.
 *
 * Clears and rebuilds #entourage's content on every call, matching the
 * clear-and-rebuild idempotency pattern used by renderDetails() in
 * eventDetailsSection.js. If `config.entourage` is missing or not an array,
 * the grid of panels is skipped gracefully (no error, no placeholder text)
 * but the section-number/heading still render - a missing entourage field
 * never breaks the page.
 *
 * @param {Object} config - EventConfig-shaped object expected to provide
 *   childName, age, and optionally entourage.
 */
export function renderEntourage(config) {
  const section = document.getElementById('entourage');
  if (!section) {
    return;
  }

  // Clear any existing content before re-rendering.
  section.textContent = '';

  const content = document.createElement('div');
  content.className = 'entourage__content';

  // Gilt oval cameo of Summer, heading this scene. Decorative - see
  // scripts/sceneCameo.js for why it carries empty alt text.
  content.appendChild(buildCameo({ src: 'assets/summer-photos/370dc895-7f9a-4e9b-bbc8-e7e1c0606de6.jpg' }));

  // Redesign pass: quiet numbered section label ("02"), matching the
  // portfolio-style reference's editorial numbered-section pattern. See
  // eventDetailsSection.js's matching comment for the .section-number
  // sizing rationale (inherits the shared 16px body size).
  const sectionNumber = document.createElement('p');
  sectionNumber.className = 'section-number';
  sectionNumber.textContent = '02';
  content.appendChild(sectionNumber);

  const heading = document.createElement('h2');
  heading.className = 'entourage__heading';
  // See this module's header, point 1, for why this is no longer "The Royal
  // Entourage": these groups are the Filipino seventh-birthday seven-symbols
  // tradition, and "entourage" is a wedding/debut term.
  heading.textContent = 'The Seven Symbols';
  content.appendChild(heading);

  // The full real dataset (6 groups / 49 names today) renders every group
  // and every member within it - never a shortened subset - as a grid of
  // self-contained framed panels (styles/entourage.css). The old vertical
  // timeline (a shared connecting line plus a sparkle divider between
  // consecutive stops) is gone; see this module's header, point 2.
  const entourage = config ? config.entourage : undefined;
  const groupElements = [];
  if (Array.isArray(entourage)) {
    const list = document.createElement('div');
    list.className = 'entourage__list';
    entourage.forEach((group) => {
      const groupElement = buildRoleGroupElement(group);
      groupElements.push(groupElement);
      list.appendChild(groupElement);
    });
    content.appendChild(list);
  }

  section.appendChild(content);

  // Register each group as its own independent `fade-up` reveal target, so
  // the panels arrive one at a time as the guest scrolls rather than all six
  // appearing simultaneously. Called after the groups are attached to
  // `section` (itself already in the live document), matching the timing
  // main.js otherwise uses when wiring up ScrollRevealController.observe().
  observe(groupElements);
}

export default renderEntourage;
