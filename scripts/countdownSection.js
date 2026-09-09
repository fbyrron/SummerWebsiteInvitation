// countdownSection.js
// CountdownSection component (design.md Component 13, tasks 15.1-15.2).
//
// This module implements:
//   - computeRemaining(targetDate, nowMs): a pure, DOM-free function per
//     design.md's "CountdownSection.computeRemaining" pseudocode, exported
//     for direct unit testing - mirrors the pattern of formatOrdinal/
//     buildHeadlineText being pure+exported in heroSection.js.
//   - render(config): builds targetDate once from config.eventDate +
//     config.eventTime and renders an initial static snapshot inside a
//     GlassCard.
//
//   - startTick(targetDate, numberEls, initialSeconds) / tick(): the
//     requestAnimationFrame-driven live update loop (task 15.3, design.md's
//     "Countdown tick" sequence diagram) that keeps the numbers current
//     after render()'s initial static snapshot, writing to the DOM only
//     when the integer `seconds` value has changed since the last frame
//     that actually wrote.
//   - The four numeric units render as plain number + label, with no
//     decorative sparkle glyphs.
//   - The "event day" alternate state (task 15.4, design.md Error
//     Scenario 5): IF the target has already passed at initial render()
//     time, the four-number grid is never built - a short "Today!"
//     message is rendered inside the GlassCard instead, and no tick loop
//     is started (nothing left to tick for a fixed targetDate whose
//     isPast can never revert to false). IF the target passes WHILE the
//     tick loop is already running (a "not past" -> "past" transition
//     mid-session), tick() performs the same one-time DOM swap on the
//     frame it first observes isPast === true, then stops rescheduling
//     itself.
//
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.1

import { build as buildGlassCard } from './glassCard.js';
import { build as buildCameo } from './sceneCameo.js';

/**
 * Computes the remaining time between `targetDate` and `nowMs`.
 *
 * Implements design.md's "CountdownSection.computeRemaining" pseudocode
 * exactly:
 *
 *   deltaMs = targetDate.getTime() - nowMs
 *   IF deltaMs <= 0 THEN RETURN { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }
 *   totalSeconds = floor(deltaMs / 1000)
 *   days = floor(totalSeconds / 86400)
 *   hours = floor(totalSeconds / 3600) MOD 24
 *   minutes = floor(totalSeconds / 60) MOD 60
 *   seconds = totalSeconds MOD 60
 *   isPast = false
 *
 * Pure function: no DOM access, no side effects, easily unit-testable -
 * mirrors the pattern of formatOrdinal/buildHeadlineText being pure+
 * exported in heroSection.js.
 *
 * Postconditions (design.md): all four numeric fields are always
 * non-negative; hours/minutes/seconds are each bounded to their natural
 * ranges (0-23 / 0-59 / 0-59); isPast is true if and only if
 * nowMs >= targetDate.getTime().
 *
 * @param {Date} targetDate
 * @param {number} nowMs
 * @returns {{days: number, hours: number, minutes: number, seconds: number, isPast: boolean}}
 */
export function computeRemaining(targetDate, nowMs) {
  const deltaMs = targetDate.getTime() - nowMs;

  if (deltaMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const totalSeconds = Math.floor(deltaMs / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
    isPast: false,
  };
}

/**
 * Parses a 12-hour "h:mm AM/PM" (or "hh:mm AM/PM") time string into
 * 24-hour hour/minute components.
 *
 * Written as a small dedicated helper (rather than reaching for
 * `Date.parse`/ISO-string parsing) because combining an arbitrary date
 * string and a "3:00 PM"-style time string into one parseable ISO string
 * is not reliable, and `Date.parse` behavior for non-ISO combined
 * date+time strings is implementation-defined and can vary across JS
 * engines. Parsing the parts by hand and constructing the `Date` via the
 * local-time `new Date(year, monthIndex, day, hours24, minutes)`
 * constructor form (see buildTargetDate below) avoids that inconsistency
 * entirely.
 *
 * @param {string} timeStr e.g. "3:00 PM"
 * @returns {{hours24: number, minutes: number}}
 */
function parseTimeOfDay(timeStr) {
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    throw new Error(`countdownSection: unable to parse eventTime "${timeStr}"`);
  }

  const [, hourStr, minuteStr, meridiem] = match;
  let hours24 = parseInt(hourStr, 10) % 12;
  if (meridiem.toUpperCase() === 'PM') {
    hours24 += 12;
  }

  return { hours24, minutes: parseInt(minuteStr, 10) };
}

/**
 * Parses a "YYYY-MM-DD" date string into its year/monthIndex/day parts.
 *
 * @param {string} dateStr e.g. "2026-10-03"
 * @returns {{year: number, monthIndex: number, day: number}}
 */
function parseDateOnly(dateStr) {
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`countdownSection: unable to parse eventDate "${dateStr}"`);
  }

  const [, yearStr, monthStr, dayStr] = match;
  return {
    year: parseInt(yearStr, 10),
    monthIndex: parseInt(monthStr, 10) - 1,
    day: parseInt(dayStr, 10),
  };
}

/**
 * Builds a single target `Date` from `config.eventDate` + `config.eventTime`.
 *
 * **Design decision (distinct from the display-only no-timezone-conversion
 * rule used elsewhere, e.g. eventDetailsSection.js's
 * formatExactNoTimezoneValue)**: the target instant is constructed using
 * the guest device's LOCAL time components - i.e. "3:00 PM" is treated as
 * 3:00 PM in whatever timezone the countdown is being viewed from. This is
 * a deliberate simplification, per design.md's Component 13, appropriate
 * for a single-venue family event where the invitation link is expected to
 * be opened by guests in the same region as the venue. It is documented
 * here as an assumption, not silently decided in code.
 *
 * Uses the local-time `new Date(year, monthIndex, day, hours24, minutes)`
 * constructor form rather than `Date.parse`/an ISO string, so the result
 * is always interpreted in the guest's local timezone and never depends on
 * inconsistent cross-engine parsing of a combined date+time string.
 *
 * @param {{eventDate: string, eventTime: string}} config
 * @returns {Date}
 */
export function buildTargetDate(config) {
  const { year, monthIndex, day } = parseDateOnly(config.eventDate);
  const { hours24, minutes } = parseTimeOfDay(config.eventTime);
  return new Date(year, monthIndex, day, hours24, minutes, 0, 0);
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Definitions for the four numeric displays, in display order. */
const UNIT_FIELDS = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
];

/**
 * Builds one numeric display block ("07" over "Days", etc.). Uses
 * textContent exclusively for the numeric value and label - both are
 * always plain numbers/static strings here, never user/config-provided
 * text, but textContent is still used for consistency with this
 * codebase's existing XSS-safety convention.
 *
 * Returns the `<p class="countdown__number">` element itself (not just the
 * wrapping unit) alongside the built unit, so `render()` can hand that
 * reference to `startTick()` (task 15.3) for later `textContent` writes -
 * the live tick loop never re-queries the DOM by class/selector, it just
 * writes directly to the exact node created here.
 *
 * @param {{key: string, label: string}} field
 * @param {number} value
 * @returns {{unit: HTMLDivElement, numberEl: HTMLParagraphElement}}
 */
function buildUnitElement(field, value) {
  const unit = document.createElement('div');
  unit.className = 'countdown__unit';

  const numberEl = document.createElement('p');
  numberEl.className = 'countdown__number';
  numberEl.textContent = pad2(value);
  unit.appendChild(numberEl);

  const labelEl = document.createElement('p');
  labelEl.className = 'countdown__label';
  labelEl.textContent = field.label;
  unit.appendChild(labelEl);

  return { unit, numberEl };
}

/**
 * Builds the "event day" alternate display (task 15.4, design.md Error
 * Scenario 5): a short celebratory message shown in place of the
 * four-number grid once `isPast` is true, rather than showing `00:00:00:00`
 * indefinitely or negative numbers.
 *
 * Kept deliberately short ("Today!") per design.md's own framing of the
 * exact wording as "an implementation detail, not a new requirement" -
 * this reads correctly both the moment the event starts and for as long
 * afterward as a guest might still open the link.
 *
 * Uses `textContent`/`createElement` only (never `innerHTML`), matching
 * this codebase's existing XSS-safety convention - though the string here
 * is a static literal, never config/user-provided.
 *
 * @returns {HTMLParagraphElement}
 */
function buildEventDayMessage() {
  const message = document.createElement('p');
  message.className = 'countdown__today';
  message.textContent = 'Today!';
  return message;
}

/**
 * Module-level state for the single live-tick requestAnimationFrame loop
 * (task 15.3). Kept minimal and private, mirroring the pattern already
 * used by sparkleBackground.js/parallaxController.js: `render()` is the
 * only way to (re)populate it, and `tick()` reads/writes it on every
 * frame.
 *
 * `lastWrittenSeconds` is the "last written seconds value" the design.md
 * sequence diagram's "changed since last paint" check compares against -
 * seeded to the seconds value already painted by render()'s own initial
 * static snapshot (see startTick()), so the very first tick() frame does
 * not redundantly rewrite a value that's already correct on screen.
 *
 * `bodyEl`/`gridEl` are only needed for the task 15.4 "not past" -> "past"
 * mid-session transition swap: `tick()` removes `gridEl` from `bodyEl` and
 * appends the event-day message in its place, exactly once.
 */
const tickState = {
  targetDate: null,
  numberEls: null,
  lastWrittenSeconds: null,
  animationFrameId: null,
  bodyEl: null,
  gridEl: null,
};

/**
 * The requestAnimationFrame loop body (design.md's "Countdown tick"
 * sequence diagram): computes the current remaining time, and writes to
 * the DOM only when the integer `seconds` value differs from
 * `tickState.lastWrittenSeconds` - i.e. only on the one frame per second
 * where the value actually ticks over, never on the many frames in
 * between where it hasn't changed yet. That single integer comparison is
 * the entire cost of a no-op frame - `computeRemaining()` itself is cheap
 * (a subtraction plus a few divisions), so running it every frame just to
 * decide whether to skip the DOM write is still far cheaper than writing
 * to the DOM every frame would be.
 *
 * Task 15.4 "not past" -> "past" transition: this loop only ever reaches
 * `isPast: true` here on a mid-session transition (render() already
 * handles the "already past at initial render" case itself and never
 * calls startTick() in that case - see render() below). The moment that
 * happens, this performs a one-time DOM swap - removing the four-number
 * grid and appending the same `buildEventDayMessage()` alternate display
 * used by render() - and then simply does not reschedule itself.
 *
 * Reasoning for stopping the rAF loop here (rather than letting it keep
 * polling forever, as sparkleBackground.js/parallaxController.js do):
 * `computeRemaining()`'s documented contract is that `isPast` is true iff
 * `nowMs >= targetDate.getTime()`, and `targetDate` is fixed once render()
 * builds it - so once `isPast` flips true it can never flip back to false
 * for the remainder of the page's lifetime. There is nothing left for this
 * loop to compute or write after the swap; continuing to call
 * `requestAnimationFrame` every frame forever afterward (unlike
 * `PerformanceMonitor.isDegraded()`, which genuinely is polled repeatedly
 * by other code for its own ongoing reasons) would be pure waste with no
 * possible future effect. This is a legitimate one-way "done" state, not
 * an ongoing condition other code needs to keep observing.
 */
function tick() {
  const { targetDate, numberEls } = tickState;
  const remaining = computeRemaining(targetDate, Date.now());

  if (remaining.isPast) {
    if (tickState.gridEl && tickState.bodyEl) {
      tickState.gridEl.remove();
      tickState.bodyEl.appendChild(buildEventDayMessage());
      tickState.gridEl = null;
    }
    // Nothing left to tick for a fixed targetDate whose isPast can never
    // revert to false - stop rescheduling instead of polling forever.
    return;
  }

  if (remaining.seconds !== tickState.lastWrittenSeconds) {
    numberEls.days.textContent = pad2(remaining.days);
    numberEls.hours.textContent = pad2(remaining.hours);
    numberEls.minutes.textContent = pad2(remaining.minutes);
    numberEls.seconds.textContent = pad2(remaining.seconds);
    tickState.lastWrittenSeconds = remaining.seconds;
  }

  tickState.animationFrameId = window.requestAnimationFrame(tick);
}

/**
 * Starts the live-updating requestAnimationFrame loop that keeps the
 * four countdown numbers current after render()'s initial static
 * snapshot (task 15.3, design.md's "Countdown tick" sequence diagram), and
 * that performs the task 15.4 mid-session "event day" swap if/when the
 * target passes while the loop is running.
 *
 * `initialSeconds` seeds `tickState.lastWrittenSeconds` to the value
 * render() already painted, so the DOM isn't redundantly rewritten with
 * the same value on the very first frame - only once the live seconds
 * value actually moves past it does the first real write happen.
 *
 * Only ever called by render() when the target has NOT already passed at
 * initial render time (render() handles the already-past case itself and
 * never reaches this call in that case), so `bodyEl`/`gridEl` are always
 * real, still-attached elements here.
 *
 * No-ops gracefully in a non-browser/test environment (no
 * `window.requestAnimationFrame`), the same guard pattern used by
 * `initSparkleBackground()`/`ParallaxController.init()` - render()'s own
 * static snapshot has already succeeded by the time this is called, so
 * that initial render is unaffected either way.
 *
 * @param {Date} targetDate
 * @param {{days: HTMLElement, hours: HTMLElement, minutes: HTMLElement, seconds: HTMLElement}} numberEls
 * @param {number} initialSeconds
 * @param {Element} bodyEl the GlassCard body the grid lives in
 * @param {Element} gridEl the four-number grid element itself
 */
function startTick(targetDate, numberEls, initialSeconds, bodyEl, gridEl) {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return;
  }

  tickState.targetDate = targetDate;
  tickState.numberEls = numberEls;
  tickState.lastWrittenSeconds = initialSeconds;
  tickState.bodyEl = bodyEl;
  tickState.gridEl = gridEl;
  tickState.animationFrameId = window.requestAnimationFrame(tick);
}

/**
 * Renders the countdown section into #countdown.
 *
 * Builds `targetDate` once from `config.eventDate` + `config.eventTime`
 * (see buildTargetDate above for the documented local-time assumption),
 * then computes a single static snapshot via
 * `computeRemaining(targetDate, Date.now())`.
 *
 * Task 15.4 (design.md Error Scenario 5) branches here on that snapshot's
 * `isPast`:
 *   - IF already past at initial render time (a guest opening the link on
 *     or after the event), the four-number grid is never built at all -
 *     `buildEventDayMessage()`'s short "Today!" state is rendered in the
 *     GlassCard instead, and `startTick()` is never called (there is
 *     nothing to count down to, and `isPast` can only ever be true from
 *     this point forward for this fixed `targetDate`).
 *   - IF not yet past, the four-number grid renders as before (tasks
 *     15.1-15.3, unchanged), and the live-tick requestAnimationFrame loop
 *     (startTick() above) is started to keep it current - including
 *     performing this same "Today!" swap itself, exactly once, if/when the
 *     target passes later while the guest still has the page open.
 *
 * Clears and rebuilds #countdown's content on every call, matching the
 * clear-and-rebuild idempotency pattern used by renderDetails()
 * (eventDetailsSection.js) and renderEntourage() (entourageSection.js).
 *
 * @param {Object} config - EventConfig-shaped object expected to provide
 *   eventDate and eventTime.
 */
export function render(config) {
  const section = document.getElementById('countdown');
  if (!section) {
    return;
  }

  const targetDate = buildTargetDate(config);
  const remaining = computeRemaining(targetDate, Date.now());

  // Clear any existing content before re-rendering.
  section.textContent = '';

  // Gilt cameo of Summer, ABOVE the glass card at the section level - not inside
  // it. `variant: 'large'` gives it the same oval locket the event-details and
  // entourage scenes use, so all three scenes head with a matching frame.
  //
  // Reverted from the previous pass, which had put a rounded-rectangle cameo
  // INSIDE the card in a two-column row beside the numbers. That row layout and
  // its `.countdown__text` wrapper are gone; the heading and grid go straight
  // back into the card body as before, and the card is once again just the
  // frosted countdown panel with a cameo sitting over it - the same shape as
  // every other scene. Decorative - see scripts/sceneCameo.js for the empty alt.
  section.appendChild(buildCameo({
    src: 'assets/summer-photos/4ab9af4f-7d64-4941-80b9-cf1b07278b27.jpg',
    variant: 'large',
  }));

  const { card, body } = buildGlassCard({ ariaLabel: 'Countdown to the celebration' });

  const heading = document.createElement('h2');
  heading.className = 'countdown__heading';
  heading.textContent = 'Countdown';
  body.appendChild(heading);

  if (remaining.isPast) {
    body.appendChild(buildEventDayMessage());
    section.appendChild(card);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'countdown__grid';

  const numberEls = {};
  UNIT_FIELDS.forEach((field) => {
    const { unit, numberEl } = buildUnitElement(field, remaining[field.key]);
    grid.appendChild(unit);
    numberEls[field.key] = numberEl;
  });

  body.appendChild(grid);
  section.appendChild(card);

  startTick(targetDate, numberEls, remaining.seconds, body, grid);
}

export default render;
