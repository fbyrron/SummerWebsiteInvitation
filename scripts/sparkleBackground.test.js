// sparkleBackground.test.js
// Unit tests for the ambient sparkle background (scripts/sparkleBackground.js).
// Covers: idempotent canvas creation, the prefers-reduced-motion static-frame
// path (no requestAnimationFrame loop started), and the non-browser/no-op
// guard. Uses a hand-rolled minimal DOM/canvas stub, matching the existing
// pattern in heroSection.test.js rather than pulling in jsdom.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { initSparkleBackground, SPARKLE_BG_CANVAS_ID } from './sparkleBackground.js';

// ---------------------------------------------------------------------------
// Minimal in-memory DOM + canvas 2d context stub
// ---------------------------------------------------------------------------

function createFake2dContext() {
  return {
    setTransform() {},
    scale() {},
    clearRect() {},
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    fill() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillStyle: null,
    globalAlpha: 1,
  };
}

class StyleStub {
  constructor() {
    this.width = '';
    this.height = '';
  }
}

class CanvasStub {
  constructor() {
    this.id = '';
    this.width = 0;
    this.height = 0;
    this.style = new StyleStub();
    this._attrs = {};
  }
  setAttribute(name, value) {
    this._attrs[name] = value;
  }
  getAttribute(name) {
    return this._attrs[name] !== undefined ? this._attrs[name] : null;
  }
  getContext(type) {
    if (type !== '2d') {
      return null;
    }
    if (!this._ctx) {
      this._ctx = createFake2dContext();
    }
    return this._ctx;
  }
}

function createDocumentStub() {
  /** @type {Map<string, CanvasStub>} */
  const byId = new Map();
  const bodyChildren = [];

  const body = {
    firstChild: null,
    insertBefore(newNode, referenceNode) {
      bodyChildren.unshift(newNode);
      body.firstChild = bodyChildren[0];
    },
  };

  return {
    body,
    getElementById(id) {
      return byId.get(id) || null;
    },
    createElement(tagName) {
      if (tagName === 'canvas') {
        const canvas = new CanvasStub();
        // Registered under whatever id is assigned to it later, via a
        // Proxy-like manual hook: tests below only ever create one canvas
        // with SPARKLE_BG_CANVAS_ID, so registering post-hoc is simplest.
        const original = canvas;
        Object.defineProperty(original, 'id', {
          get() { return this._id; },
          set(value) {
            this._id = value;
            byId.set(value, original);
          },
        });
        return original;
      }
      throw new Error(`Unexpected createElement call: ${tagName}`);
    },
    _bodyChildren: bodyChildren,
  };
}

function createWindowStub({ prefersReducedMotion = false } = {}) {
  const listeners = {};
  return {
    innerWidth: 1024,
    innerHeight: 768,
    devicePixelRatio: 1,
    matchMedia(query) {
      return {
        media: query,
        matches: query.includes('reduced-motion') ? prefersReducedMotion : false,
      };
    },
    requestAnimationFrame(cb) {
      // Never actually invoke `cb` in these tests - we only want to assert
      // *whether* the loop was started, not drive frames.
      return 1;
    },
    addEventListener() {},
    _listeners: listeners,
  };
}

describe('initSparkleBackground', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  test('creates exactly one #sparkle-bg canvas as the first child of body', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;
    globalThis.window = createWindowStub();

    initSparkleBackground();

    assert.equal(doc._bodyChildren.length, 1);
    assert.equal(doc._bodyChildren[0].id, SPARKLE_BG_CANVAS_ID);
    assert.equal(doc.getElementById(SPARKLE_BG_CANVAS_ID), doc._bodyChildren[0]);
  });

  test('is idempotent: a second call does not create a duplicate canvas', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;
    globalThis.window = createWindowStub();

    initSparkleBackground();
    initSparkleBackground();

    assert.equal(doc._bodyChildren.length, 1);
  });

  test('marks the canvas aria-hidden for assistive technology', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;
    globalThis.window = createWindowStub();

    initSparkleBackground();

    const canvas = doc.getElementById(SPARKLE_BG_CANVAS_ID);
    assert.equal(canvas._attrs['aria-hidden'], 'true');
  });

  test('reduced motion: draws a static frame and does not start a requestAnimationFrame loop', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    let rafCalls = 0;
    const win = createWindowStub({ prefersReducedMotion: true });
    win.requestAnimationFrame = () => {
      rafCalls += 1;
      return 1;
    };
    globalThis.window = win;

    initSparkleBackground();

    assert.equal(rafCalls, 0, 'expected requestAnimationFrame to never be called under reduced motion');
  });

  test('normal motion: starts exactly one requestAnimationFrame loop', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;

    let rafCalls = 0;
    const win = createWindowStub({ prefersReducedMotion: false });
    win.requestAnimationFrame = () => {
      rafCalls += 1;
      return 1;
    };
    globalThis.window = win;

    initSparkleBackground();

    assert.equal(rafCalls, 1);
  });

  test('no-ops gracefully with no document/window (non-browser environment)', () => {
    globalThis.document = undefined;
    globalThis.window = undefined;

    assert.doesNotThrow(() => initSparkleBackground());
  });

  test('no-ops gracefully when requestAnimationFrame is unavailable', () => {
    const doc = createDocumentStub();
    globalThis.document = doc;
    const win = createWindowStub();
    delete win.requestAnimationFrame;
    globalThis.window = win;

    assert.doesNotThrow(() => initSparkleBackground());
    assert.equal(doc._bodyChildren.length, 0, 'expected no canvas to be created when rAF is unavailable');
  });
});
