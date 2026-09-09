// heroSection.test.js
// Unit tests for HeroSection (design.md Component 9).
//
// -----------------------------------------------------------------------
// THIS PASS: the artwork IS the screen, the button stacks on top
// -----------------------------------------------------------------------
// Rewritten to match heroSection.js after the switch to a full-bleed
// `<picture>` background with the button stacked over it.
//
// Coverage REMOVED:
//   renderBackdrop()  the blurred fill layer is gone - `cover` leaves no empty
//                     space for it to fill, so the function no longer exists.
//
// Coverage CHANGED:
//   renderInvitation()  the artwork is now a <picture> with a wide-screen
//                       <source> (laptop-bg.png) and a portrait <img> fallback
//                       (phone-bg.png), not a single <img>. Tests updated to
//                       assert both sources, the one shared alt, and that the
//                       <img> is still the accessible/fallback element.
//   render()            composes TWO things now (artwork + button), not three.
//
// Coverage KEPT:
//   buildInvitationAltText()  still the highest-value test here - the
//                             invitation's words are pixels in the artwork, so
//                             this string is the only way a screen-reader user
//                             receives them.
//   renderCallToAction(), ensureDecorativeFontOrFallback(),
//   formatOrdinal, buildHeadlineText  unchanged.
//
// _Requirements: 1.1, 1.2, 1.3, 1.5, 10.1

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  render,
  renderInvitation,
  renderCallToAction,
  ensureDecorativeFontOrFallback,
  formatOrdinal,
  buildHeadlineText,
  buildInvitationAltText,
  DECORATIVE_FONT_TIMEOUT_MS,
} from './heroSection.js';

// ---------------------------------------------------------------------------
// Minimal in-memory DOM stub
// ---------------------------------------------------------------------------
// heroSection.js's DOM surface: document.getElementById, document.createElement,
// element.querySelector, classList.add/contains, setAttribute, property
// assignment (src/srcset/media/width/height/alt/decoding), and
// document.fonts.load. A hand-rolled stub covering just that is enough.
//
// Tag names are lowercased in the constructor, so `.tagName` comparisons match
// real-DOM lowercase regardless of how createElement was called - this pass
// checks for 'picture', 'source' and 'img'. Tests reach nested elements (the
// <img>/<source> inside a <picture>) with a plain `.children.find(...)` on the
// parent, so no tag-search helper is needed on the stub.

class ClassListStub {
  constructor(initial = []) {
    this._classes = new Set(initial);
  }
  add(...names) {
    names.forEach((name) => this._classes.add(name));
  }
  remove(name) {
    this._classes.delete(name);
  }
  contains(name) {
    return this._classes.has(name);
  }
}

class ElementStub {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
    this.id = '';
    this.classList = new ClassListStub();
    this.textContent = '';
    this.style = {};
    this.dataset = {};
    this.children = [];
    this._attributes = {};
  }
  get className() {
    return Array.from(this.classList._classes).join(' ');
  }
  set className(value) {
    this.classList = new ClassListStub(String(value).split(/\s+/).filter(Boolean));
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(name, value) {
    this._attributes[name] = value;
  }
  getAttribute(name) {
    return this._attributes[name];
  }
  /** Depth-first search for the first descendant whose classList has `className`. */
  _findDescendant(className) {
    for (const child of this.children) {
      if (child.classList && child.classList.contains(className)) {
        return child;
      }
      if (typeof child._findDescendant === 'function') {
        const found = child._findDescendant(className);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }
  /** Same traversal, collecting every match. */
  _findAllDescendants(className, out = []) {
    for (const child of this.children) {
      if (child.classList && child.classList.contains(className)) {
        out.push(child);
      }
      if (typeof child._findAllDescendants === 'function') {
        child._findAllDescendants(className, out);
      }
    }
    return out;
  }
  querySelector(selector) {
    if (!selector.startsWith('.')) {
      return null;
    }
    return this._findDescendant(selector.slice(1));
  }
  querySelectorAll(selector) {
    if (!selector.startsWith('.')) {
      return [];
    }
    return this._findAllDescendants(selector.slice(1));
  }
}

/**
 * Builds a minimal `document` stub with a `#hero` section, plus a recursive
 * getElementById that also finds any element appended into `#hero` (at any
 * depth) by its `.id`.
 */
function createDocumentStub({ fontsLoad } = {}) {
  const heroSection = new ElementStub('section');
  heroSection.id = 'hero';

  function findById(el, id) {
    for (const child of el.children || []) {
      if (child.id === id) {
        return child;
      }
      const found = findById(child, id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  return {
    getElementById(id) {
      if (id === 'hero') return heroSection;
      return findById(heroSection, id);
    },
    createElement(tagName) {
      return new ElementStub(tagName);
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: text };
    },
    fonts: fontsLoad ? { load: fontsLoad } : undefined,
    _heroSection: heroSection,
  };
}

// ---------------------------------------------------------------------------
// formatOrdinal
// ---------------------------------------------------------------------------

describe('formatOrdinal', () => {
  const cases = [
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
  ];

  for (const [age, expected] of cases) {
    test(`formatOrdinal(${age}) === "${expected}"`, () => {
      assert.equal(formatOrdinal(age), expected);
    });
  }
});

// ---------------------------------------------------------------------------
// buildHeadlineText: no longer rendered anywhere (the headline is lettering
// inside the artwork now) but kept as this project's canonical "whose birthday,
// and which one" string. Its exact output shape is still asserted.
// ---------------------------------------------------------------------------

describe('buildHeadlineText', () => {
  test('builds the uppercase possessive-ordinal-BIRTHDAY headline', () => {
    assert.equal(buildHeadlineText({ childName: 'Summer', age: 7 }), "SUMMER'S 7TH BIRTHDAY");
  });

  test('uses the correct ordinal suffix for an 11-13 edge case age', () => {
    assert.equal(buildHeadlineText({ childName: 'Alex', age: 12 }), "ALEX'S 12TH BIRTHDAY");
  });

  test('uses the correct ordinal suffix for a 21 edge case age', () => {
    assert.equal(buildHeadlineText({ childName: 'Jamie', age: 21 }), "JAMIE'S 21ST BIRTHDAY");
  });
});

// ---------------------------------------------------------------------------
// buildInvitationAltText: the artwork's text alternative.
//
// The highest-value coverage in this file. The invitation's words exist only as
// pixels in the artwork, so this string is the ONLY way a screen-reader user
// receives the invitation at all.
// ---------------------------------------------------------------------------

describe('buildInvitationAltText', () => {
  test('spells out the artwork\'s own lettering, built from config', () => {
    const alt = buildInvitationAltText({ childName: 'Summer', age: 7 });
    assert.match(alt, /You are invited/i);
    assert.match(alt, /Summer's/);
    assert.match(alt, /7th Birthday/i);
  });

  test('describes the image itself, not only its text', () => {
    const alt = buildInvitationAltText({ childName: 'Summer', age: 7 });
    assert.match(alt, /castle/i);
  });

  test('is config-driven, not hardcoded to Summer or 7', () => {
    const alt = buildInvitationAltText({ childName: 'Alex', age: 12 });
    assert.match(alt, /Alex's/);
    assert.match(alt, /12th Birthday/i);
    assert.ok(!alt.includes('Summer'), 'expected no hardcoded "Summer"');
    assert.ok(!alt.includes('7th'), 'expected no hardcoded "7th"');
  });

  test('falls back to a generic description rather than emitting a blank name', () => {
    for (const config of [undefined, {}, { childName: 'Summer' }, { age: 7 }]) {
      const alt = buildInvitationAltText(config);
      assert.match(alt, /You are invited/i, 'expected a usable alt even without full config');
      assert.ok(!alt.includes("'s "), `expected no dangling possessive in: ${alt}`);
    }
  });
});

// ---------------------------------------------------------------------------
// renderInvitation(): the artwork, now a full-bleed <picture>.
// ---------------------------------------------------------------------------

describe('renderInvitation', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  test('renders a <picture class="hero-invitation"> inside .hero-scene', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    renderInvitation({ childName: 'Summer', age: 7 });

    const scene = doc._heroSection.children.find((c) => c.classList.contains('hero-scene'));
    assert.ok(scene, 'expected a .hero-scene wrapper to have been appended to #hero');

    const picture = scene.children.find((c) => c.classList.contains('hero-invitation'));
    assert.ok(picture, 'expected a .hero-invitation element inside .hero-scene');
    assert.equal(picture.tagName, 'picture');
  });

  test('serves the landscape artwork to wide screens via a <source media>', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    renderInvitation({ childName: 'Summer', age: 7 });

    const picture = doc._heroSection.querySelector('.hero-invitation');
    const source = picture.children.find((c) => c.tagName === 'source');
    assert.ok(source, 'expected a <source> for wide screens');
    assert.equal(source.media, '(min-width: 768px)');
    assert.equal(source.srcset, 'assets/summer-photos/laptop-bg.png');
    // Landscape intrinsic size, so the box is reserved before load.
    assert.equal(source.width, 1536);
    assert.equal(source.height, 1024);
  });

  test('the <img> fallback is the portrait artwork and carries the alt + intrinsic size', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    const config = { childName: 'Summer', age: 7 };
    renderInvitation(config);

    const picture = doc._heroSection.querySelector('.hero-invitation');
    const img = picture.children.find((c) => c.tagName === 'img');
    assert.ok(img, 'expected an <img> fallback inside the <picture>');
    assert.equal(img.src, 'assets/summer-photos/phone-bg.png');
    assert.equal(img.width, 1024);
    assert.equal(img.height, 1536);
    // The one shared alt for the whole <picture> lives on the <img>.
    assert.equal(img.alt, buildInvitationAltText(config));
  });

  test('the artwork is not lazy-loaded — it is the entire landing view', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    renderInvitation({ childName: 'Summer', age: 7 });

    const img = doc._heroSection.querySelector('.hero-invitation').children.find((c) => c.tagName === 'img');
    assert.notEqual(img.loading, 'lazy', 'the landing artwork must not be deferred');
    assert.equal(img.getAttribute('fetchpriority'), 'high');
  });

  test('is idempotent: a second call does not append a duplicate picture', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    renderInvitation({ childName: 'Summer', age: 7 });
    renderInvitation({ childName: 'Summer', age: 7 });

    const scene = doc._heroSection.querySelector('.hero-scene');
    assert.equal(scene.children.filter((c) => c.classList.contains('hero-invitation')).length, 1);
  });

  test('is a no-op when #hero is not present', () => {
    const doc = createDocumentStub();
    doc.getElementById = () => null;
    globalThis.document = doc;

    assert.doesNotThrow(() => renderInvitation({ childName: 'Summer', age: 7 }));
  });
});

// ---------------------------------------------------------------------------
// renderCallToAction(): the one button, stacked over the artwork. Destination
// and label unchanged across every pass, per the user's explicit confirmation.
// ---------------------------------------------------------------------------

describe('renderCallToAction', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  test('renders a link labeled "VIEW DETAILS" pointing at details.html', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    renderCallToAction();

    const scene = doc._heroSection.querySelector('.hero-scene');
    const link = scene.children.find((c) => c.tagName === 'a');
    assert.ok(link, 'expected a CTA link inside .hero-scene');
    assert.equal(link.textContent, 'VIEW DETAILS');
    assert.equal(link.href, 'details.html');
    assert.equal(link.id, 'hero-cta-button');
  });

  test('carries the shared cta-button + castle-button classes and the hero layout modifier', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    renderCallToAction();

    const link = doc.getElementById('hero-cta-button');
    assert.ok(link.classList.contains('cta-button'), 'expected the shared .cta-button class');
    assert.ok(link.classList.contains('castle-button'), 'expected the shared .castle-button class');
    assert.ok(link.classList.contains('hero-cta-button--ornate'), 'expected the .hero-cta-button--ornate layout modifier');
  });

  test('is idempotent: a second call does not append a duplicate link', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    renderCallToAction();
    renderCallToAction();

    const scene = doc._heroSection.querySelector('.hero-scene');
    assert.equal(scene.children.filter((c) => c.tagName === 'a').length, 1);
  });

  test('is a no-op when #hero is not present', () => {
    const doc = createDocumentStub();
    doc.getElementById = () => null;
    globalThis.document = doc;

    assert.doesNotThrow(() => renderCallToAction());
  });
});

// ---------------------------------------------------------------------------
// ensureDecorativeFontOrFallback(): watches Cinzel and classes the CTA button,
// the page's only remaining webfont text.
// ---------------------------------------------------------------------------

describe('ensureDecorativeFontOrFallback', () => {
  const FALLBACK_FONT_CLASS = 'hero-cta-button--fallback-font';

  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  test('does not apply the fallback class when the font resolves before the timeout', async () => {
    const doc = createDocumentStub({ fontsLoad: () => Promise.resolve() });
    globalThis.document = doc;
    renderCallToAction();

    await ensureDecorativeFontOrFallback(50);

    const button = doc.getElementById('hero-cta-button');
    assert.equal(button.classList.contains(FALLBACK_FONT_CLASS), false);
  });

  test('applies the fallback class to the CTA button when the load never resolves', async () => {
    const doc = createDocumentStub({ fontsLoad: () => new Promise(() => {}) }); // never settles
    globalThis.document = doc;
    renderCallToAction();

    await ensureDecorativeFontOrFallback(50);

    const button = doc.getElementById('hero-cta-button');
    assert.equal(button.classList.contains(FALLBACK_FONT_CLASS), true);
  });

  test('applies the fallback class when the font load rejects', async () => {
    const doc = createDocumentStub({ fontsLoad: () => Promise.reject(new Error('font load failed')) });
    globalThis.document = doc;
    renderCallToAction();

    await ensureDecorativeFontOrFallback(50);

    const button = doc.getElementById('hero-cta-button');
    assert.equal(button.classList.contains(FALLBACK_FONT_CLASS), true);
  });

  test('does not throw when there is no CTA button to class', async () => {
    const doc = createDocumentStub({ fontsLoad: () => Promise.reject(new Error('nope')) });
    globalThis.document = doc;

    await assert.doesNotReject(() => ensureDecorativeFontOrFallback(50));
  });

  test('default timeout parameter still equals DECORATIVE_FONT_TIMEOUT_MS (3000ms)', () => {
    assert.equal(DECORATIVE_FONT_TIMEOUT_MS, 3000);
  });
});

// ---------------------------------------------------------------------------
// render(config): the composed entry point (design.md's HeroSection.render)
// ---------------------------------------------------------------------------

describe('render', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  test('renders exactly two things: the artwork and the button, in that order', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    render({ childName: 'Summer', age: 7 });

    const scene = doc._heroSection.querySelector('.hero-scene');
    assert.ok(scene, 'expected the scene wrapper');
    assert.ok(scene.querySelector('.hero-invitation'), 'expected the invitation artwork');
    assert.ok(doc.getElementById('hero-cta-button'), 'expected the CTA button');

    // A stack of two: the full-bleed artwork and the button over it. Nothing
    // else - no backdrop layer anymore, no frame, copy, nav, photo or badge.
    assert.equal(scene.children.length, 2, `expected exactly 2 children, got ${scene.children.length}`);

    // Artwork appended first, button second: DOM order sets paint order in the
    // shared grid cell, so the button stacks on top.
    assert.ok(scene.children[0].classList.contains('hero-invitation'), 'expected the artwork first');
    assert.equal(scene.children[1].tagName, 'a', 'expected the button second');
  });

  test('the blurred backdrop layer is gone', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    render({ childName: 'Summer', age: 7 });

    // `cover` leaves no empty space, so the fill layer was removed. Guards
    // against it being reintroduced by accident.
    assert.equal(doc._heroSection.querySelector('.hero-backdrop'), null, 'expected no .hero-backdrop');
  });

  test('none of the deleted hero furniture is rendered anymore', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    render({ childName: 'Summer', age: 7 });

    const hero = doc._heroSection;
    for (const gone of [
      'hero-bg-garden',
      'hero-castle',
      'hero-colonnade',
      'hero-nav',
      'hero-photo',
      'hero-frame',
      'hero-frame__mat',
      'hero-copy',
      'headline',
      'hero-badge',
      'hero-flourish',
      'hero-backdrop',
    ]) {
      assert.equal(hero.querySelector(`.${gone}`), null, `expected .${gone} to be gone`);
    }
  });

  test('a second render() call does not duplicate any layer', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    const config = { childName: 'Summer', age: 7 };
    render(config);
    render(config);

    const scene = doc._heroSection.querySelector('.hero-scene');
    assert.equal(doc._heroSection.children.filter((c) => c.classList.contains('hero-scene')).length, 1);
    assert.equal(scene.children.filter((c) => c.classList.contains('hero-invitation')).length, 1);
    assert.equal(scene.children.filter((c) => c.tagName === 'a').length, 1);
  });

  test('is a no-op when #hero is not present', () => {
    const doc = createDocumentStub();
    doc.getElementById = () => null;
    globalThis.document = doc;

    assert.doesNotThrow(() => render({ childName: 'Summer', age: 7 }));
  });
});
