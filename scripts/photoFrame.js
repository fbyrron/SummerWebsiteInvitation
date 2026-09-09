// photoFrame.js
// Component 5: PhotoFrame (design.md, shared helper used by HeroSection and
// GallerySection, tasks 11.2/12.1).
//
// PhotoFrame.build({label, aspect, slot, src}) returns a fixed-aspect-ratio,
// gold-bordered, watercolor-shadow container around a real <img> sourced
// from assets/summer-photos/. The <img> always uses object-fit: contain
// (never cover) against the frame's own background wash (styles/photoFrame.css),
// so the treatment reads correctly whether `src` is today's plain JPG or a
// later background-removed cutout PNG of the same subject - no code change
// needed when a slot's `src` is swapped (design.md Component 5).
//
// Error Scenario 1 (design.md): if the photo fails to load, the <img> is
// replaced (inside the same gold-bordered frame) with a styled placeholder
// box showing `label` - never a broken-image icon, never blank space.
//
// Uses createElement/textContent/attribute-setting exclusively, never
// innerHTML, per this codebase's existing XSS-safety convention (see
// heroSection.js's renderHeadline, entourageSection.js) - `label` is
// documented as potentially caller-provided text.

/**
 * Builds the styled fallback placeholder shown in place of the <img> when
 * the photo fails to load (Error Scenario 1). Fills the frame the same way
 * the <img> does, so swapping one for the other causes no layout shift.
 *
 * @param {*} label
 * @returns {HTMLDivElement}
 */
function buildPlaceholder(label) {
  const placeholder = document.createElement('div');
  placeholder.className = 'photo-frame__placeholder';

  const text = document.createElement('span');
  text.className = 'photo-frame__placeholder-label';
  text.textContent = label != null ? String(label) : '';
  placeholder.appendChild(text);

  return placeholder;
}

/**
 * Builds one PhotoFrame: a fixed-aspect-ratio, gold-bordered container with
 * a soft watercolor-style drop shadow, wrapping an
 * `<img data-photo-slot="{slot}" src="{src}" alt="{label}">`.
 *
 * @param {{label?: string, aspect?: string, slot?: string, src?: string}} options
 * @returns {HTMLDivElement}
 */
export function build(options) {
  const { label, aspect, slot, src } = options || {};

  const frame = document.createElement('div');
  frame.className = 'photo-frame';

  // `aspect-ratio` CSS (e.g. "3/4", "1/1") controls the frame's proportions
  // (design.md Component 5). Set as an inline style so each instance can
  // have its own ratio without a matching CSS class per ratio value;
  // styles/photoFrame.css supplies a sane default via a custom property
  // for the (unexpected) case where `aspect` is omitted.
  if (aspect != null && String(aspect).trim() !== '') {
    frame.style.aspectRatio = String(aspect);
  }

  const img = document.createElement('img');
  img.className = 'photo-frame__img';
  if (slot != null) {
    img.dataset.photoSlot = String(slot);
  }
  img.alt = label != null ? String(label) : '';
  img.src = src != null ? String(src) : '';

  // Error Scenario 1: on load failure, swap the <img> for the styled
  // placeholder box - never a broken-image icon, never blank space. Fires
  // at most once per element (`{ once: true }`), and only acts if the
  // image is still the frame's current child (defensive, in case this
  // frame was already torn down by the time a slow/failed load settles).
  img.addEventListener('error', () => {
    if (frame.contains(img)) {
      frame.replaceChild(buildPlaceholder(label), img);
    }
  }, { once: true });

  frame.appendChild(img);
  return frame;
}

// Default export matches design.md's `PhotoFrame.build(...)` pseudocode
// interface shape, alongside the named export for direct `{ build }` imports.
export default { build };
