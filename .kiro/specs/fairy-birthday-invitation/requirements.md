# Requirements Document

> **Redesign notice (supersedes prior version):** This requirements document
> replaces the earlier four-discrete-section, click-to-advance model with a
> single continuous scrolling page of seven scenes in an Enchanted Fairy
> Garden Princess visual style. See `design.md` for the full architecture and
> the module-by-module migration table.

## Introduction

This spec, Fairy Birthday Invitation, covers a mobile-first, single-page
website inviting guests to Summer's 7th birthday. The guest scrolls
continuously through seven storybook scenes — Hero, Princess Gallery, Event
Details, Royal Entourage, Countdown, RSVP, and Closing — each revealing
itself with scroll-triggered animation over a parallax backdrop of cherry
blossoms, petals, butterflies, and glowing fairy dust. All content is driven
by the single `EventConfig` source. The event-day photobooth feature remains
explicitly out of scope (see `design.md` Future Phase Note).

## Glossary

- **EventConfig**: The single event configuration source (childName, age,
  eventDate, eventTime, venueName, venueAddress, optional mapLink,
  rsvpContact, themeNote, optional giftNote, optional rsvpLink, optional
  message, themeColors, entourage) that drives all invitation content.
- **Scene**: One of the seven continuous sections of the single scrolling
  page (Hero, Gallery, Event Details, Entourage, Countdown, RSVP, Closing).
  Scenes are never hidden/shown as discrete pages — they are always present
  in the document and revealed visually as the guest scrolls to them.
- **Scroll reveal**: The one-time fade/slide/zoom entrance animation applied
  to an element the first time it scrolls into the viewport.
- **Parallax layer**: A visual layer (background branches, mid-layer
  petals, foreground sparkles) that moves at a fraction of the page's scroll
  speed, creating a sense of depth.
- **Photo frame**: A styled, gold-bordered container that displays a real
  photo from `assets/summer-photos/`, designed so its `<img>` source can
  later be substituted for a background-removed (transparent-background)
  cutout of the same subject with no layout change; if its photo file is
  missing or fails to load, it falls back to a styled placeholder box with
  a label rather than a broken-image icon.
- **prefers-reduced-motion**: The device/browser accessibility setting
  indicating the user has requested reduced motion, which the system SHALL
  honor by disabling motion-based animations (reveal, parallax, ambient
  particles) in favor of an immediate final visible state.
- **Viewport**: The visible rendering area of the guest's browser window,
  measured in pixels width.
- **Breakpoint**: A defined viewport width threshold (768px) at which
  layout, typography, or decorative element sizing changes.

## Requirements

### Requirement 1: Hero / Opening Scene

**User Story:** As a guest opening the invitation link, I want an
immersive opening scene that sets the storybook tone and tells me who,
what, and where, so that I instantly understand the invitation and want to
keep scrolling.

#### Acceptance Criteria

1. WHEN the page finishes loading, THE system SHALL display, in order, the
   exact lines "ONCE UPON A TIME...", "A little princess is turning
   seven.", "Join us as we celebrate", a headline built from
   `config.childName` and `config.age` (e.g. "SUMMER'S 7TH BIRTHDAY"),
   `config.eventDate`, and `config.venueName`.
2. WHEN the hero scene is displayed, THE system SHALL render a large photo
   frame occupying most of the viewport height, displaying a real photo
   from `assets/summer-photos/` with a soft magical lighting overlay,
   styled so the photo's source can later be substituted for a
   background-removed cutout of the same subject with no layout change.
3. WHEN the hero scene is displayed, THE system SHALL render a button
   labeled "BEGIN THE STORY" that, when activated, smooth-scrolls the page
   to the Princess Gallery scene (or scrolls instantly under
   `prefers-reduced-motion`), rather than hiding/showing any section.
4. WHEN the hero scene is rendered on a viewport of 320px width or greater,
   THE system SHALL NOT cause horizontal overflow or clipped text.
5. IF the decorative heading typeface fails to load within 3000
   milliseconds, THEN THE system SHALL render the heading text using a
   fallback font while still meeting the content and overflow requirements
   of this section.
6. WHEN the hero scene is displayed, THE system SHALL render animated
   decorative butterflies, petals, and sparkles around the photo frame,
   each honoring the reduced-motion and reveal-once rules in Requirement 8.

### Requirement 2: Princess Gallery scene

**User Story:** As a guest, I want to see a magical-feeling photo gallery
as I scroll, so that the invitation feels personal and storybook-like even
before real photos are added.

#### Acceptance Criteria

1. WHEN the guest scrolls to the gallery scene, THE system SHALL display
   exactly one gallery section containing three photo slots, each
   displaying a real photo from `assets/summer-photos/`, arranged in a
   staggered scrapbook layout: one main center slot, one lower-left slot,
   and one lower-right slot.
2. WHEN the gallery scene is rendered, THE system SHALL style each photo
   slot with a gold decorative frame, a watercolor-style drop shadow, and
   nearby floating blossom decorations.
3. WHEN the main center slot scrolls into view, THE system SHALL animate it
   with a fade-and-zoom-in reveal; WHEN the lower-left slot scrolls into
   view, THE system SHALL animate it sliding in from the left; WHEN the
   lower-right slot scrolls into view, THE system SHALL animate it sliding
   in from the right.
4. THE system SHALL render each gallery slot as a photo frame (per the
   Glossary) displaying its assigned real photo, with no broken-image
   state, and with no layout change required if that photo's source is
   later substituted for a background-removed cutout of the same subject.
5. WHEN the gallery scene is rendered on a viewport of 320px width or
   greater, THE system SHALL NOT cause horizontal overflow or clipped
   content.

### Requirement 3: Event Details scene

**User Story:** As a guest, I want to see the event's date, time, venue,
dress code, and RSVP contact in one clear, elegant place, so that I know
when and where to go and what to do next.

#### Acceptance Criteria

1. WHEN the guest scrolls to the event details scene, THE system SHALL
   display the event date, time, venue name, and venue address inside a
   floating glassmorphism card (frosted/translucent background, gold
   accents, rounded corners) presented over a floral backdrop layer.
2. WHEN the event details scene is rendered, THE system SHALL also display
   the dress-code note and RSVP contact, sourced from `config.themeNote` and
   `config.rsvpContact` respectively, rendered verbatim rather than as a
   shortened example string.
3. IF `eventDate` is not a valid calendar date, `eventTime` is not a valid
   time value, `venueName` is empty or missing, `venueAddress` is empty or
   missing, `rsvpContact` is empty or missing, or `themeNote` is empty or
   missing in the site configuration, THEN THE system SHALL fail the build
   with a validation error rather than rendering blank or placeholder
   content.
4. WHEN viewed on a mobile viewport (320px–480px), THE system SHALL display
   the event details card as primary, unobstructed content above any
   decorative floral backdrop elements.
5. THE system SHALL display the event date and time exactly as provided in
   the site configuration, without converting them to the guest device's
   local time zone.
6. WHERE `mapLink` is present in the site configuration, THE system SHALL
   display it as a "how to get there" link within the event details card;
   IF `mapLink` is not provided, THEN THE system SHALL render the card
   without a "how to get there" link and without any placeholder or blank
   content in its place.
7. WHERE `giftNote` is present in the site configuration, THE system SHALL
   display it within the event details card; IF `giftNote` is not
   provided, THEN THE system SHALL render the card without gift-related
   content and without any placeholder or blank content in its place.
8. IF the guest's browser does not support the CSS `backdrop-filter`
   property used for the glassmorphism effect, THEN THE system SHALL render
   the card with a fallback background treatment that keeps its content
   readable, rather than relying on the blur for legibility.
9. WHEN the event details scene is rendered, THE system SHALL display, in
   addition to the dress-code text, a row of small filled color circles —
   one circle per entry in `config.themeColors`, in array order, each
   rendered in that entry's exact color — as a visual dress-code swatch.

### Requirement 4: Royal Entourage scene

**User Story:** As a guest, I want to see the full entourage presented in a
special, magical way, so that everyone who is part of the celebration feels
recognized.

#### Acceptance Criteria

1. WHEN the guest scrolls to the entourage scene, THE system SHALL render
   every role group present in `config.entourage` (currently six groups —
   7 Roses, 7 Candles, 7 Blind Box, 7 Shoes, 7 Wishes, 7 Pajamas — totaling
   49 names) and every member name within each group; THE system SHALL NOT
   substitute a shortened or example subset of the configured entourage
   data.
2. WHEN the entourage scene is rendered, THE system SHALL present the role
   groups as a vertical "magical timeline" with floral decorations between
   groups, titled "The Royal Entourage", rather than as a plain unstyled
   text list.
3. WHEN each role group scrolls into view, THE system SHALL animate that
   group into view independently of the other groups.
4. WHEN the entourage scene is rendered on a viewport of 320px width or
   greater, THE system SHALL NOT cause horizontal overflow, and long member
   names SHALL wrap rather than being clipped or forcing horizontal scroll.

### Requirement 5: Countdown scene

**User Story:** As a guest, I want to see a live countdown to the event, so
that I get a sense of anticipation and know how much time remains.

#### Acceptance Criteria

1. WHEN the guest scrolls to the countdown scene, THE system SHALL display
   a live-updating countdown to the date/time formed from `config.eventDate`
   and `config.eventTime`, broken into Days, Hours, Minutes, and Seconds.
2. THE system SHALL update the countdown display at least once per second
   while the countdown scene is present on the page, driven by a
   frame-synchronized mechanism (e.g. `requestAnimationFrame`) rather than a
   fixed timer.
3. THE system SHALL render the countdown inside a glassmorphism card with
   gold accents and decorative sparkles around the numeric values.
4. IF the current time is at or after the target event date/time, THEN THE
   system SHALL display all four countdown values as zero and SHALL NOT
   display negative numbers, showing an alternate "event day" state instead
   of a stuck zero countdown.
5. THE system SHALL NOT allow any of the four displayed countdown values to
   be negative at any time.

### Requirement 6: RSVP scene

**User Story:** As a guest, I want a clear way to confirm my attendance, so
that the hosts know I'm coming.

#### Acceptance Criteria

1. WHEN the guest scrolls to the RSVP scene, THE system SHALL display a
   heading reading "Reserve Your Magical Seat", a decorative floral frame,
   and a button labeled "RSVP NOW".
2. IF `config.rsvpLink` is present and non-empty, THEN WHEN the guest
   activates the "RSVP NOW" button, THE system SHALL open `config.rsvpLink`
   in a new browser tab, with `rel="noopener noreferrer"` applied, and
   SHALL NOT reveal the contact card described in Criterion 3.
3. IF `config.rsvpLink` is absent or empty, THEN WHEN the guest activates
   the "RSVP NOW" button, THE system SHALL reveal and scroll to a styled
   card displaying `config.rsvpContact` verbatim; THE system SHALL NOT
   submit any data to a backend or third-party form service as part of
   this action.
4. THE system SHALL structure the RSVP button behavior (the `rsvpLink`
   branch of Criterion 2 and the contact-card-reveal branch of Criterion 3)
   behind a single, documented function so that supplying a real
   `rsvpLink` later requires only a configuration change, with no changes
   to any other scene.

### Requirement 7: Closing / Ending scene

**User Story:** As a guest reaching the end of the invitation, I want a
warm, magical closing message, so that the invitation feels complete and
memorable.

#### Acceptance Criteria

1. WHEN the guest scrolls to the closing scene, THE system SHALL display
   the exact lines "Thank you for being part of Summer's magical
   celebration.", "We cannot wait to see you in our enchanted garden.",
   "With Love,", and `config.childName` on its own line.
2. WHEN the closing scene first scrolls into view, THE system SHALL
   increase the density of the ambient background sparkle/petal/glow
   effect so the ending reads as more magical than earlier scenes, without
   starting a second, separate particle system.
3. WHEN the closing scene is rendered on a viewport of 320px width or
   greater, THE system SHALL NOT cause horizontal overflow or clipped text.

### Requirement 8: Scroll-triggered storytelling (reveal + parallax)

**User Story:** As a guest scrolling through the invitation, I want each
scene to gently reveal itself and the background to drift with a sense of
depth, so that the experience feels alive without requiring me to click
anything to advance.

#### Acceptance Criteria

1. THE system SHALL NOT require the guest to click or tap any control to
   advance between scenes; all seven scenes SHALL be present in the
   document at all times and progressed through by ordinary page scrolling.
2. WHEN an element registered for scroll reveal enters the viewport, THE
   system SHALL play that element's configured entrance animation (fade,
   slide, or zoom, per element) exactly once; scrolling that element out of
   and back into view again SHALL NOT replay or re-trigger the animation.
3. WHILE the guest scrolls, THE system SHALL move at least three
   distinct parallax layers (background cherry-blossom branches, mid-layer
   petals, and foreground sparkles) at different speeds relative to scroll
   position, creating a layered depth effect.
4. WHILE any parallax layer is animating, THE system SHALL keep that
   layer's computed offset within one viewport height of its resting
   position at all times.
5. WHILE the guest scrolls, THE system SHALL occasionally animate a
   butterfly sprite crossing the screen, independent of the parallax
   layers and independent of any specific scene.

### Requirement 9: Mobile-first responsive layout

**User Story:** As a guest opening the invitation on a phone, I want the
layout to look correct and be easy to use without zooming or horizontal
scrolling, so that I can read the invitation comfortably.

#### Acceptance Criteria

1. WHEN the site is rendered at any viewport width from 320px to 1920px,
   THE system SHALL NOT produce horizontal scrolling or content overflow,
   in any of the seven scenes.
2. WHEN the site is rendered at a viewport width of 768px or greater, THE
   system SHALL increase typography size and decorative element size
   according to the defined breakpoint rules, without violating the
   overflow rule in Criterion 1.
3. WHEN any decorative or parallax asset is displayed at any viewport width
   from 320px to 1920px, THE system SHALL constrain the asset's rendered
   width to its container width so that it does not cause horizontal
   overflow.
4. THE system SHALL render all body and heading text at a minimum font size
   of 16px, and SHALL NOT disable or restrict user pinch-zoom, so that
   guests can read all content without being required to zoom in.

### Requirement 10: Accessibility and reduced motion

**User Story:** As a guest with motion sensitivity or who uses assistive
technology, I want the invitation to remain fully usable and readable, so
that the experience doesn't cause discomfort or exclude me.

#### Acceptance Criteria

1. IF the guest's device has `prefers-reduced-motion` enabled, THEN THE
   system SHALL display every scroll-reveal target immediately in its final
   visible state, with no fade/slide/zoom entrance animation ever played.
2. IF the guest's device has `prefers-reduced-motion` enabled, THEN THE
   system SHALL NOT move any parallax layer in response to scroll, and
   SHALL render the ambient particle field as a single static frame rather
   than an animated loop.
3. THE system SHALL provide meaningful ARIA labeling for each scene and for
   the glassmorphism cards (event details, countdown, RSVP contact), and
   SHALL ensure the "BEGIN THE STORY" and "RSVP NOW" controls are reachable
   and operable via keyboard.
4. THE system SHALL NOT convey any content exclusively through motion or
   through a decorative effect alone (e.g. glassmorphism blur) — every
   glassmorphism card SHALL remain readable via a fallback style on
   browsers without `backdrop-filter` support.

### Requirement 11: Performance and graceful degradation

**User Story:** As a guest on a mid-tier or older mobile device, I want
scrolling and animations to stay smooth, so that the experience doesn't
feel janky or freeze my browser.

#### Acceptance Criteria

1. WHILE any animation is playing (reveal, parallax, ambient particles,
   countdown updates), THE system SHALL drive it using a frame-synchronized
   animation mechanism (e.g. `requestAnimationFrame`) rather than fixed
   timers such as `setInterval`.
2. IF the number of active ambient particles would exceed the
   device-appropriate maximum, THEN THE system SHALL cap particle creation
   to stay within that maximum, where the maximum SHALL be 30 particles on
   viewport widths of 768px or narrower and 60 particles on viewport widths
   wider than 768px, before any density multiplier or degraded-mode
   reduction is applied.
3. IF a decorative heading or body font fails to load within 3000
   milliseconds, THEN THE system SHALL fall back to a standard font for
   that family rather than leaving text invisible or blocking page render.
4. IF a rolling average frame time of 33 milliseconds or greater is
   sustained for 2000 milliseconds (2 seconds) or longer, THEN THE system
   SHALL reduce the active ambient particle count by 50% (floored at 10
   particles) and SHALL stop applying per-frame parallax offsets, without
   freezing or blocking scrolling.

### Requirement 12: Content configurability

**User Story:** As the site owner, I want the child's name, age, event
date/time/venue, RSVP contact, theme note, gift note, theme colors, and
entourage defined in one place, so that I can update invitation details
without touching layout code.

#### Acceptance Criteria

1. WHEN the site builds or loads, THE system SHALL source `childName`,
   `age`, `eventDate`, `eventTime`, `venueName`, `venueAddress`, an optional
   `mapLink`, `rsvpContact`, `themeNote`, an optional `giftNote`, an
   optional `rsvpLink`, an optional `message` of at most 280 characters,
   one or more theme colors, and the entourage role groups from a single
   event configuration source, and SHALL render every one of the values
   above exactly as configured (with no timezone conversion applied to
   date/time values) wherever it appears across any of the seven scenes.
2. IF `childName` is empty or exceeds 100 characters, OR `age` is not a
   positive integer between 1 and 120, OR `venueName` is empty or exceeds
   200 characters, OR `venueAddress` is empty or exceeds 200 characters, OR
   `rsvpContact` is empty or exceeds 200 characters, OR `themeNote` is empty
   or exceeds 200 characters, OR `eventDate` is not a valid calendar date on
   or after the site's build date, OR `eventTime` is not a valid time
   value, OR `themeColors` contains zero colors, THEN THE system SHALL
   treat the configuration as invalid and SHALL prevent the site from
   rendering.
3. IF the event configuration source cannot be loaded or parsed, THEN THE
   system SHALL prevent the site from rendering and SHALL produce an
   observable error indicating that the configuration could not be loaded,
   distinct from a field-validation error.
4. IF the configuration is invalid per Criterion 2 or Criterion 5, THEN THE
   system SHALL produce an observable error identifying which field(s)
   failed validation and SHALL NOT render partial or placeholder content in
   place of the failed fields.
5. IF `mapLink` is present and exceeds 500 characters, OR `giftNote` is
   present and exceeds 280 characters, OR `rsvpLink` is present and exceeds
   500 characters, THEN THE system SHALL treat the configuration as invalid
   and SHALL prevent the site from rendering.

## Out of Scope

- Event-day photobooth (guest photo upload/viewing) — deferred to a future
  phase per `design.md`.
- User accounts, authentication, or RSVP data storage — not requested and
  not covered by this spec.
- A real RSVP form/backend integration — an optional `rsvpLink` field now
  supports linking out to an external event page (e.g. lu.ma) per
  Requirement 6; until the user supplies a real URL, the behavior is the
  no-backend contact-info reveal described in Requirement 6, Criterion 3.
- Real photo assets — superseded: real photos now exist at
  `assets/summer-photos/` and are used by the Hero and Gallery photo
  frames (Requirements 1.2, 2.1). Automated background removal remains out
  of scope — no image-processing/ML tooling is used by this spec; any
  background-removed cutout is produced outside this codebase and dropped
  in as a photo frame's `<img>` source later.
