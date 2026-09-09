# Implementation Plan: Fairy Birthday Invitation

## Overview

> **Redesign notice (supersedes prior version):** This plan replaces the
> earlier four-page/click-to-advance task list with tasks for the
> single-scroll, seven-scene Enchanted Fairy Garden Princess redesign (see
> `design.md`). Vanilla HTML/CSS/JS, no bundler, no framework — unchanged.
> Tasks 1-4 below are largely mechanical removals/renames of the superseded
> navigation modules; tasks 5+ build the new architecture.

Config schema, validation rules, and the config-loading modules
(`eventConfig.js`, `eventConfigValidator.js`, `configLoader.js`,
`configErrorReporter.js`) require no structural changes beyond the
`themeColors` content update and the new optional `rsvpLink` field, both in
task 2.

Real photos now exist at `assets/summer-photos/` and are used directly by
`PhotoFrame` (task 10.1) — see `design.md` Components 5, 9, and 10 for the
slot assignment. Automated background removal is out of scope; no
image-processing/ML dependency should be added by any task below.

## Tasks

- [x] 1. Remove superseded navigation modules and their tests
  - Delete `scripts/fairyTransitionController.js` and
    `scripts/sectionScrollObserver.js` (see `design.md` Migration table —
    both are superseded by the continuous-scroll model; the frame-time
    monitor and `IntersectionObserver` patterns they contain are
    reimplemented fresh in tasks 6 and 9, not copied forward as-is)
  - Delete or rewrite any existing test files that exercise
    `triggerFairyTransition`, `isTransitioning`, `hasAdjacentSection`,
    `computeFlightPath`/`evaluatePathAt`, `playSimpleCrossFade`,
    `goToNext`/`goToPrevious`/`onSectionChange`/`getCurrentSection` — none
    of these APIs exist in the new architecture
  - Remove the `.section-next-btn` delegated click handler and the
    `SECTION_IDS` navigation array from `scripts/main.js` (full rewrite of
    this file happens in task 12)
  - _Requirements: 8.1_

- [x] 2. Update EventConfig theme colors to the new palette and add the
  `rsvpLink` field
  - Update `themeColors` in `scripts/eventConfig.js` to the five exact hex
    values from `design.md` (`#FFDCE8`, `#DCCBFF`, `#FCEEF4`, `#FFFDFB`,
    `#D4AF37`) — schema/validation rules are unchanged, this is a content
    value change only
  - Add an optional `rsvpLink` field to the `EventConfig` schema
    (`scripts/eventConfig.js`, JSDoc comment block) and set it to an empty
    string placeholder for now, ready for the user to fill in with their
    real lu.ma URL later
  - Add `rsvpLink` validation to `scripts/eventConfigValidator.js`: if
    present and non-empty, must not exceed 500 characters (same pattern as
    the existing `mapLink` validation); absent/empty is valid
  - _Requirements: 12.1, 12.5_

- [x] 3. Rewrite `index.html` for the seven-scene continuous-scroll structure
  - Replace the four `hidden`-toggled `<section>`s with seven always-visible
    `<section>` elements in document order: `#hero`, `#gallery`,
    `#event-details`, `#entourage`, `#countdown`, `#rsvp`, `#closing` —
    none carry a `hidden` attribute
  - Add container elements for the three parallax layers and the ambient
    particle canvas host (per `design.md` Architecture diagram)
  - Add the second Google Fonts `<link>` for Poppins alongside the existing
    Playfair Display link
  - Set `background-image: linear-gradient(180deg, #FFF9FC, #F7F1FF,
    #FFFBF8)` as the single page-wide background (replacing the prior
    per-section gradient)
  - _Requirements: 8.1, 9.1_

- [x] 4. Update the design token layer in `styles/base.css`
  - Replace `--color-accent-lavender`/`--color-accent-pink`/
    `--color-accent-gold`/`--color-bg-gradient-*` values with the new
    tokens (`--color-blush-pink`, `--color-lavender`, `--color-soft-rose`,
    `--color-ivory`, `--color-gold`) per `design.md` Model 5, keeping the
    same 16px-minimum body/heading font-size rules and overflow-guard rules
    already in place
  - Add `--font-heading: "Playfair Display", ...` and
    `--font-body: "Poppins", ...` custom properties (Poppins replaces the
    system-font stack as the primary body/UI font; system fonts remain the
    final fallback tier only)
  - Remove the now-unused `.cta-button`/`.section--fading-*`/
    `#hero[hidden]` rules tied to the removed page-swap model
  - _Requirements: 9.4, 12.1_

- [x] 5. Implement FontLoader
  - [x] 5.1 Implement `ensureFontsOrFallback(timeoutMs)` generalizing the
    existing single-font timeout logic (from the prior `heroSection.js`) to
    race both Playfair Display and Poppins independently against a shared
    3000ms timeout, applying each family's own fallback class on its own
    failure without blocking the other
    - _Requirements: 1.5, 11.3_
  - [ ]* 5.2 Write unit tests for independent per-family timeout/fallback
    behavior (one family resolves, the other times out)
    - _Requirements: 1.5, 11.3_

- [x] 6. Implement PerformanceMonitor
  - [x] 6.1 Implement `recordFrame(nowMs)` and `isDegraded()` using the
    sliding 2000ms rolling-average-frame-time-≥33ms detection rule (ported
    from the removed `fairyTransitionController.js`'s frame-time monitor;
    same one-way "degraded" persistence choice)
    - _Requirements: 11.4_
  - [ ]* 6.2 Write unit tests for the degradation threshold and its
    one-way/persistent behavior
    - _Requirements: 11.4_

- [x] 7. Implement ScrollRevealController
  - [x] 7.1 Implement `observe(elements)` reading each element's
    `data-reveal-direction` attribute and adding `.reveal--visible` on first
    intersection past a 0.15 threshold, then `unobserve()`-ing that element
    - _Requirements: 8.2_
  - [x] 7.2 Implement the reduced-motion / no-`IntersectionObserver` path:
    `revealNow()` applied synchronously to every element instead of
    registering an observer
    - _Requirements: 10.1_
  - [ ]* 7.3 Write property test for **Property 2: Every reveal fires at
    most once per element**
    - **Validates: Requirement 8.2**
  - [ ]* 7.4 Write unit test confirming the reduced-motion path never
    creates an `IntersectionObserver` and reveals every element immediately
    - _Requirements: 10.1_

- [x] 8. Implement ParallaxController
  - [x] 8.1 Implement `init(layers)`: a single `requestAnimationFrame` loop
    reading `window.scrollY` once per frame, applying
    `translate3d(0, clamp(scrollY * speed, -viewportHeight, viewportHeight),
    0)` per registered layer
    - _Requirements: 8.3, 8.4_
  - [x] 8.2 Implement the reduced-motion guard: `init()` never starts the
    rAF loop when `prefers-reduced-motion` is set; every layer stays at its
    authored resting position
    - _Requirements: 10.2_
  - [x] 8.3 Implement `enableMouseParallax(heroElement)` as an optional,
    `(pointer: fine)`-gated enhancement computed inside the same rAF loop,
    never run under reduced motion and never on touch-only devices
    - _Requirements: 8.3_
  - [x] 8.4 Wire `ParallaxController` to `PerformanceMonitor.isDegraded()`:
    stop applying per-frame offsets (freeze layers at current position)
    once degraded
    - _Requirements: 11.4_
  - [ ]* 8.5 Write property test for **Property 4: Parallax offsets stay
    within one viewport height**
    - **Validates: Requirement 8.4**
  - [ ]* 8.6 Write unit test confirming the reduced-motion path never starts
    the rAF loop
    - _Requirements: 10.2_

- [x] 9. Implement AmbientParticleField (extends the existing sparkle
  background canvas)
  - [x] 9.1 Extend the existing ambient sparkle canvas module with
    `setDensity(multiplier)`, scaling the active particle cap by
    `multiplier` without creating a second canvas/animation loop
    - _Requirements: 7.2_
  - [x] 9.2 Add a small butterfly-sprite pool (2-3 max) that occasionally
    drifts across the full page width on an independent, randomized
    schedule, unrelated to scroll position
    - _Requirements: 8.5_
  - [x] 9.3 Wire the existing device-tier particle cap (30 at ≤768px, 60 at
    >768px) plus `setDensity()`'s multiplier and `PerformanceMonitor`'s
    degraded-mode reduction (floor of 10) into one combined effective-cap
    calculation, with degraded-mode taking precedence over any density
    multiplier
    - _Requirements: 11.2, 11.4_
  - [ ]* 9.4 Write property test for **Property 6: Ambient particle cap
    scales with viewport width and with degraded-mode/density multiplier**
    - **Validates: Requirements 11.2, 11.4**
  - [ ]* 9.5 Write unit test confirming the reduced-motion path renders one
    static frame and never starts the animation loop (already covered for
    the base canvas; extend coverage to the added butterfly pool)
    - _Requirements: 10.2_

- [x] 10. Implement shared helpers: PhotoFrame and GlassCard
  - [x] 10.1 Implement `PhotoFrame.build({label, aspect, slot, src})`: a
    fixed-aspect-ratio, gold-bordered, watercolor-shadow container
    rendering an `<img data-photo-slot="{slot}" src="{src}"
    alt="{label}">` sourced from `assets/summer-photos/`, using
    `object-fit: contain` (not `cover`) against the frame's own background
    wash so the treatment reads correctly whether `src` is today's plain
    JPG or a later background-removed cutout PNG of the same subject; if
    the photo fails to load, fall back to the styled placeholder box with
    `label` (per `design.md` Error Scenario 1) — never a broken-image icon
    - _Requirements: 1.2, 2.4_
  - [x] 10.2 Implement `GlassCard.build({ariaLabel})`: a `backdrop-filter`
    frosted card with gold border/rounded corners, plus a
    `@supports not (backdrop-filter: blur(1px))` fallback rule (in a new
    `styles/glass.css`) that raises background opacity so the card stays
    readable without blur
    - _Requirements: 3.1, 3.8, 10.4_
  - [ ]* 10.3 Write property test for **Property 10: Glassmorphism cards
    remain readable without `backdrop-filter` support** (assert the
    `@supports not (...)` fallback rule exists and its background-opacity
    value meets a documented minimum)
    - **Validates: Requirement 10.4**
  - [ ]* 10.4 Write unit test confirming `PhotoFrame` uses `object-fit:
    contain` (never `cover`) on its `<img>`, and falls back to the styled
    placeholder box when the photo fails to load
    - _Requirements: 1.2, 2.4_

- [ ] 11. Rewrite HeroSection ("Once Upon a Time...")
  - [x] 11.1 Implement `render(config)` rendering the exact copy lines
    ("ONCE UPON A TIME...", "A little princess is turning seven.", "Join us
    as we celebrate", the `config.childName`/`config.age`-built headline,
    `config.eventDate`, `config.venueName`), each displayed exactly as
    configured with no timezone conversion
    - _Requirements: 1.1, 12.1_
  - [x] 11.2 Render a `PhotoFrame` ("hero" slot, large, most-of-viewport,
    `src: assets/summer-photos/04a7fc0e-e895-4d6d-a7d7-6adc9c6dfcc3.jpg` per
    `design.md` Component 9 — reorder later if desired) with a soft magical
    lighting overlay (CSS radial-gradient wash on the frame, not the photo,
    so it still reads correctly if `src` is later swapped for a
    background-removed cutout)
    - _Requirements: 1.2_
  - [x] 11.3 Render the "BEGIN THE STORY" button wired to
    `document.getElementById('gallery').scrollIntoView({behavior: ...})`,
    smooth unless `prefers-reduced-motion` is set
    - _Requirements: 1.3, 10.1_
  - [x] 11.4 Register decorative butterflies/petals/sparkles as
    `data-reveal-direction="fade-up"` targets for `ScrollRevealController`
    - _Requirements: 1.6, 8.2_
  - [x] 11.5 Verify no horizontal overflow/clipped text at 320px width and
    above
    - _Requirements: 1.4, 9.1_
  - [ ]* 11.6 Write unit tests for the headline text builder and the
    font-fallback path (reusing the pattern from the prior `heroSection.js`
    tests, updated for the new copy/CTA)
    - _Requirements: 1.1, 1.5_

- [x] 12. Implement GallerySection ("Princess Gallery")
  - [x] 12.1 Implement `render()` building the three `PhotoFrame` slots in
    the staggered scrapbook layout, with gold frames and floral accents,
    each sourced per `design.md` Component 10's slot table: `gallery-main`
    (3/4 aspect, `src:
    assets/summer-photos/0c916870-f108-4633-924f-b9470ad9cbe1.jpg`),
    `gallery-left` (1/1 aspect, `src:
    assets/summer-photos/1fa9e8ef-131b-4c0c-9129-dd6d8c88988d.jpg`),
    `gallery-right` (1/1 aspect, `src:
    assets/summer-photos/35afc0da-58f4-4fa5-b474-78f35f8fdf65.jpg`) —
    reorder later if desired; the remaining four photos in
    `assets/summer-photos/` are unused for now
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 12.2 Register `gallery-main` as a `zoom-in` reveal target,
    `gallery-left` as `slide-left`, `gallery-right` as `slide-right`
    - _Requirements: 2.3, 8.2_
  - [x] 12.3 Verify no horizontal overflow at 320px width and above
    - _Requirements: 2.5, 9.1_

- [~] 13. Rewrite EventDetailsSection as a floating GlassCard
  - [x] 13.1 Implement `renderDetails(config)` rendering DATE, TIME, VENUE,
    ADDRESS, DRESS CODE (`config.themeNote`, rendered verbatim), and RSVP
    (`config.rsvpContact`, rendered verbatim) inside a `GlassCard`, each
    field displayed exactly as configured with no timezone conversion
    - _Requirements: 3.1, 3.2, 3.5_
  - [x] 13.1a Render a dress-code color-swatch row beneath the DRESS CODE
    text: one small filled circle per entry in `config.themeColors`, in
    array order, each circle's `background-color` set to that entry's exact
    hex value — presentation-only, no new validation
    - _Requirements: 3.9_
  - [x] 13.2 Render a floral backdrop layer behind the card, registered as a
    `ParallaxController` mid-layer target
    - _Requirements: 3.1, 8.3_
  - [x] 13.3 Implement conditional rendering of `mapLink` (as a "how to get
    there" link) and `giftNote`, each shown only when present, with no
    placeholder/blank content when absent
    - _Requirements: 3.6, 3.7_
  - [x] 13.4 Verify primary content (date/time/venue/address/dress
    code/RSVP) is unobstructed on mobile viewports (320px-480px)
    - _Requirements: 3.4, 9.1_
  - [ ]* 13.5 Write property test for **Property 7 (Event Details portion):
    EventConfig values render exactly, with no timezone conversion**
    - **Validates: Requirement 3.5, Requirement 12.1**
  - [ ]* 13.6 Write property test for **Property 8: Optional fields render
    only when present, with no placeholder content**
    - **Validates: Requirements 3.6, 3.7**
  - [ ]* 13.7 Write property test for **Property 11: Dress-code swatches
    match `config.themeColors` exactly** (swatch count equals
    `config.themeColors.length`; each swatch's rendered color equals its
    config hex value)
    - **Validates: Requirement 3.9**

- [ ] 14. Rewrite EntourageSection as "The Royal Entourage" magical timeline
  - [x] 14.1 Implement `renderEntourage(config)` rendering every group in
    `config.entourage` and every member within each group (full real
    dataset — 6 groups / 49 names today — never a shortened subset) as a
    vertical timeline with a central gold connecting line and floral
    dividers between groups, titled "The Royal Entourage"
    - _Requirements: 4.1, 4.2_
  - [x] 14.2 Register each role group as its own `fade-up` reveal target so
    groups animate in independently as the guest scrolls
    - _Requirements: 4.3, 8.2_
  - [x] 14.3 Verify long member names wrap rather than clip/overflow at
    320px width and above
    - _Requirements: 4.4, 9.1_
  - [ ]* 14.4 Write property test for **Property 9: The entourage renders
    the full real dataset, not a shortened example**
    - **Validates: Requirement 4.1**

- [x] 15. Implement CountdownSection
  - [x] 15.1 Implement `computeRemaining(targetDate, nowMs)` per
    `design.md`'s pseudocode: non-negative days/hours/minutes/seconds,
    `isPast` flag, correct rollover at day/hour/minute boundaries
    - _Requirements: 5.1, 5.4, 5.5_
  - [x] 15.2 Implement `render(config)` building `targetDate` from
    `config.eventDate` + `config.eventTime` (local-time assumption
    documented per `design.md`), rendering inside a `GlassCard` with
    decorative gold sparkle glyphs around the numbers
    - _Requirements: 5.1, 5.3_
  - [x] 15.3 Drive the display update via `requestAnimationFrame`, writing
    to the DOM only when the integer seconds value changes since the last
    paint
    - _Requirements: 5.2, 11.1_
  - [x] 15.4 Implement the "event day" alternate state shown when
    `isPast === true`, replacing the four-number display
    - _Requirements: 5.4_
  - [ ]* 15.5 Write property test for **Property 5: Countdown numbers are
    never negative and clamp correctly at the target**
    - **Validates: Requirement 5.4, 5.5**
  - [ ]* 15.6 Write unit tests for day/hour/minute/second rollover boundary
    values (e.g. exactly 86400000ms remaining)
    - _Requirements: 5.1_

- [x] 16. Implement RsvpSection
  - [x] 16.1 Implement `render(config)` rendering the "Reserve Your Magical
    Seat" heading, decorative floral frame, "RSVP NOW" button, and a
    de-emphasized (but present, reachable) contact card built via
    `GlassCard`
    - _Requirements: 6.1_
  - [x] 16.2 Implement `revealContactCard()`: adds an emphasized class and
    smooth-scrolls (instant under reduced motion) the card into view,
    displaying `config.rsvpContact` verbatim; submits no data anywhere
    - _Requirements: 6.3_
  - [x] 16.3 Wire the "RSVP NOW" button per `config.rsvpLink`: WHERE
    present and non-empty, clicking it opens `config.rsvpLink` in a new tab
    with `target="_blank" rel="noopener noreferrer"` and does not call
    `revealContactCard()`; WHERE absent/empty (the current state, until the
    user supplies their real lu.ma URL in `eventConfig.js`), clicking it
    calls `revealContactCard()` exactly as before
    - _Requirements: 6.2, 6.3_
  - [x] 16.4 Document the `rsvpLink` branch behavior directly above the
    button-wiring code as the documented single seam for the RSVP action,
    per `design.md` Component 6
    - _Requirements: 6.4_
  - [ ]* 16.5 Write unit tests for the `rsvpLink`-present branch (opens new
    tab with `noopener noreferrer`, does not reveal contact card) and the
    `rsvpLink`-absent branch (reveals contact card, as before)
    - _Requirements: 6.2, 6.3_

- [x] 17. Rewrite ClosingSection
  - [x] 17.1 Implement `renderClosing(config)` rendering the exact copy
    ("Thank you for being part of Summer's magical celebration.", "We
    cannot wait to see you in our enchanted garden.", "With Love,",
    `config.childName`)
    - _Requirements: 7.1_
  - [x] 17.2 Register the closing scene as a reveal target that calls
    `AmbientParticleField.setDensity(1.6)` exactly once on first reveal
    - _Requirements: 7.2_
  - [x] 17.3 Verify no horizontal overflow/clipped text at 320px width and
    above
    - _Requirements: 7.3, 9.1_

- [x] 18. Responsive layout pass across all seven scenes
  - [x] 18.1 Apply/extend the existing mobile-first base styles (320px
    baseline) and 768px breakpoint scaling to the new scene markup
    (gallery, countdown, RSVP, plus the rewritten hero/details/entourage/
    closing), keeping the 16px minimum font size and unrestricted
    pinch-zoom rules
    - _Requirements: 9.1, 9.2, 9.4_
  - [x] 18.2 Constrain every decorative/parallax asset to its container
    width at every breakpoint
    - _Requirements: 9.3_
  - [ ]* 18.3 Add checks/tests confirming no overflow at 320px, 375px,
    768px, 1024px, 1440px, and 1920px across all seven scenes
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ]* 18.4 Write property test for **Property 1: No horizontal overflow
    across supported viewport widths (320px-1920px)**
    - **Validates: Requirements 9.1, 9.3**

- [x] 19. Accessibility pass
  - [x] 19.1 Add ARIA labels to each scene `<section>` and to every
    `GlassCard` instance
    - _Requirements: 10.3_
  - [x] 19.2 Verify "BEGIN THE STORY" and "RSVP NOW" are reachable and
    operable via keyboard (native `<button>` elements, visible focus style)
    - _Requirements: 10.3_
  - [ ]* 19.3 Write property test for **Property 3: Reduced motion replaces
    every scroll/parallax animation with an instant final state** (covering
    `ScrollRevealController`, `ParallaxController`, and
    `AmbientParticleField` together)
    - **Validates: Requirements 10.1, 10.2**

- [x] 20. Wire up main application entry point
  - Load and validate `EventConfig` (surfacing config-source-load-failure
    and field-validation-failure errors distinctly, unchanged from the
    prior design); render all seven sections once; call
    `AmbientParticleField.init()`, `ParallaxController.init(...)`,
    `ScrollRevealController.observe(...)`, and `FontLoader
    .ensureFontsOrFallback()`; wire the hero's smooth-scroll-to-gallery CTA
    and the RSVP button's `rsvpLink`-branch/contact-card-reveal behavior
    (task 16.3)
  - _Requirements: 1.1, 1.3, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 12.1, 12.3_

- [x] 21. Cross-cutting verification pass
  - [x] 21.1 Manual check with OS-level reduced motion enabled across all
    seven scenes: confirm every reveal/parallax/particle effect degrades to
    an instant/static state, with no motion-only content
    - _Requirements: 10.1, 10.2_
  - [x] 21.2 Manual mobile device check for scroll smoothness and absence of
    horizontal overflow across the full page, 320px-1920px
    - _Requirements: 9.1, 11.4_
  - [x] 21.3 Confirm build fails clearly both when EventConfig fails
    field-level validation and when the config source itself fails to
    load/parse (unchanged behavior, re-verified against the new rendering
    flow)
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
  - [x] 21.4 Manual visual QA of the new palette/typography across
    breakpoints: 320px, 375px, 768px, 1024px, 1440px, 1920px
    - _Requirements: 9.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP.
- Each task references specific requirement criteria for traceability.
- Task 1 must land before tasks 7-9 begin, since it removes the modules
  those tasks' replacements are built from — see the Task Dependency Graph.
- Real photos exist at `assets/summer-photos/`; every `PhotoFrame` usage
  (tasks 11.2, 12.1) renders its assigned real photo, falling back to a
  styled placeholder only per `design.md` Error Scenario 1 (missing/failed
  photo file), not a broken image or blank space. Automated background
  removal is out of scope — no image-processing/ML dependency should be
  added by any task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "4"] },
    { "id": 2, "tasks": ["5.1", "6.1", "10.1", "10.2"] },
    { "id": 3, "tasks": ["7.1", "7.2", "8.1", "8.2", "9.1", "9.2"] },
    { "id": 4, "tasks": ["8.3", "8.4", "9.3"] },
    { "id": 5, "tasks": ["11.1", "11.2", "11.3", "11.4", "12.1", "13.1", "13.1a", "13.2", "13.3", "14.1", "14.2", "15.1", "15.2", "16.1", "17.1"] },
    { "id": 6, "tasks": ["11.5", "12.2", "12.3", "13.4", "14.3", "15.3", "16.2", "16.3", "16.4", "17.2"] },
    { "id": 7, "tasks": ["15.4", "17.3"] },
    { "id": 8, "tasks": ["18.1", "18.2", "19.1", "19.2"] },
    { "id": 9, "tasks": ["20"] },
    { "id": 10, "tasks": ["5.2", "6.2", "7.3", "7.4", "8.5", "8.6", "9.4", "9.5", "10.3", "10.4", "11.6", "13.5", "13.6", "13.7", "14.4", "15.5", "15.6", "16.5", "18.3", "18.4", "19.3"] },
    { "id": 11, "tasks": ["21.1", "21.2", "21.3", "21.4"] }
  ]
}
```
