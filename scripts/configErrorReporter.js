// configErrorReporter.js
// Error reporting for EventConfig failures (Task 2.4), covering both
// failure modes surfaced elsewhere in the config pipeline:
//
//   - Config-source-load-failure (Error Scenario 4 / Requirement 6.3):
//     a `ConfigLoadError` thrown by `loadEventConfig()` (configLoader.js,
//     Task 2.3).
//   - Field-validation-failure (Error Scenario 3 / Requirement 6.4):
//     the `{valid: false, errors: [{field, message}, ...]}` result
//     returned by `validateEventConfig()` (eventConfigValidator.js, Task 2.2).
//
// This module owns exactly one concern: turning either failure into a
// visible, "observable" error state on the page. For a static site with no
// logging backend, "observable" means rendered to the DOM so a human looking
// at the page (or reading its accessible text) can see exactly what failed.
//
// This module does NOT decide *when* to call itself instead of the normal
// render path - that wiring is Task 9's job (main.js). Task 9 must call one
// of the functions below in place of rendering HeroSection/EventDetailsSection
// whenever `loadEventConfig()` rejects, or `validateEventConfig()` returns
// `{valid: false, ...}`, and must NOT proceed to render either section
// afterward. Each renderer here replaces the entire `#app` container's
// contents (rather than appending to it), specifically so that no partial or
// placeholder section content can ever appear alongside the error - even if
// some earlier code already put something into `#app` before the failure
// was detected.
//
// Field names and messages ultimately originate from config content, so
// every dynamic value is inserted via `textContent`, never `innerHTML`.
//
// Requirements: 6.4 (this task); kept symmetric with the config-load-failure
// path (Requirement 6.3 / Task 2.3) so Task 9 has a single, uniform call
// site (`reportConfigError`) for both failure branches.

import { ConfigLoadError } from './configLoader.js';

const APP_CONTAINER_ID = 'app';

/**
 * @returns {HTMLElement|null} the `#app` container, or `null` outside a DOM
 *   environment (e.g. a Node-based manual trace) or if `#app` is missing.
 */
function getAppContainer() {
  return typeof document === 'undefined' ? null : document.getElementById(APP_CONTAINER_ID);
}

/**
 * Builds the shared error container shell (heading + intro message), used by
 * every failure-mode renderer below so all error states look and behave
 * consistently, and are equally observable to assistive technology.
 *
 * @param {string} headingText
 * @param {string} introText
 * @returns {{container: HTMLElement, body: HTMLElement}} `container` is the
 *   full error element ready to insert; `body` is an empty slot renderers
 *   can append failure-specific detail into (e.g. a field list).
 */
function buildErrorShell(headingText, introText) {
  const container = document.createElement('div');
  container.className = 'config-error';
  // role="alert" makes this observable to assistive tech as soon as it's
  // inserted, without requiring the user to focus or scroll to it.
  container.setAttribute('role', 'alert');

  const heading = document.createElement('h1');
  heading.className = 'config-error__heading';
  heading.textContent = headingText;

  const intro = document.createElement('p');
  intro.className = 'config-error__message';
  intro.textContent = introText;

  const body = document.createElement('div');
  body.className = 'config-error__body';

  container.appendChild(heading);
  container.appendChild(intro);
  container.appendChild(body);

  return { container, body };
}

/**
 * Replaces `#app`'s entire contents with `errorElement`. Clearing first
 * (rather than appending) is what guarantees no other rendering
 * (HeroSection, EventDetailsSection, etc.) can appear alongside the error,
 * regardless of what may already have been rendered into `#app`.
 *
 * Actually preventing HeroSection/EventDetailsSection from rendering *after*
 * this call is Task 9's responsibility (it must not call their render
 * functions once an error has been reported) - this function only
 * guarantees the DOM state at the moment it runs.
 *
 * @param {HTMLElement} errorElement
 */
function renderIntoApp(errorElement) {
  const app = getAppContainer();
  if (!app) {
    return;
  }
  app.textContent = '';
  app.appendChild(errorElement);
}

/**
 * Renders the observable "configuration could not be loaded" error state
 * (Error Scenario 4 / Requirement 6.3), for use when `loadEventConfig()`
 * throws a `ConfigLoadError`.
 *
 * @param {ConfigLoadError|Error} [error] - the thrown error, if available.
 *   Only its `message` is used for extra context; no partial/raw config
 *   content is ever rendered here.
 */
export function reportConfigLoadError(error) {
  const { container } = buildErrorShell(
    'Invitation unavailable',
    'Configuration could not be loaded.'
  );

  if (error && typeof error.message === 'string' && error.message.trim().length > 0) {
    const detail = document.createElement('p');
    detail.className = 'config-error__detail';
    detail.textContent = error.message;
    container.appendChild(detail);
  }

  renderIntoApp(container);
}

/**
 * Renders the observable field-validation-failure error state
 * (Error Scenario 3 / Requirement 6.4), for use when `validateEventConfig()`
 * returns `{valid: false, errors}`.
 *
 * Every failed field and its message is listed, so it's clear which
 * field(s) failed validation; no partial or placeholder content is rendered
 * in place of the failed fields, since this replaces the whole `#app`
 * region instead of any section content.
 *
 * @param {Array<{field: string, message: string}>} errors - the `errors`
 *   array from `validateEventConfig`'s failure result.
 */
export function reportFieldValidationErrors(errors) {
  const list = Array.isArray(errors) ? errors : [];

  const { container, body } = buildErrorShell(
    'Invitation unavailable',
    list.length === 1
      ? 'The event configuration has 1 field that failed validation:'
      : `The event configuration has ${list.length} fields that failed validation:`
  );

  const errorList = document.createElement('ul');
  errorList.className = 'config-error__list';

  list.forEach((entry) => {
    const { field, message } = entry || {};

    const item = document.createElement('li');
    item.className = 'config-error__item';

    const fieldName = document.createElement('strong');
    fieldName.className = 'config-error__field';
    fieldName.textContent = field != null ? String(field) : '(unknown field)';

    const reason = document.createElement('span');
    reason.className = 'config-error__reason';
    reason.textContent = message != null ? `: ${String(message)}` : '';

    item.appendChild(fieldName);
    item.appendChild(reason);
    errorList.appendChild(item);
  });

  body.appendChild(errorList);
  renderIntoApp(container);
}

/**
 * Renders a generic, observable error state for an unrecognized failure
 * shape. Used only as a defensive fallback by `reportConfigError()` below,
 * so an unexpected input still produces a visible error rather than
 * silently failing or throwing.
 */
function reportUnknownConfigError() {
  const { container } = buildErrorShell(
    'Invitation unavailable',
    'The event configuration is invalid.'
  );
  renderIntoApp(container);
}

/**
 * Single general entry point covering both EventConfig failure modes, so
 * Task 9's app wiring can call one function in either failure branch
 * without needing to know rendering details. Branches on the shape of
 * `errorOrResult`:
 *
 *   - A `ConfigLoadError` (or any object with `type === 'CONFIG_LOAD_FAILURE'`,
 *     matching `ConfigLoadError.type` from configLoader.js) -> the
 *     config-source-load-failure path (`reportConfigLoadError`).
 *   - A `validateEventConfig()` failure result (`{valid: false, errors: [...]}`)
 *     or a bare `errors` array -> the field-validation-failure path
 *     (`reportFieldValidationErrors`).
 *   - Anything else -> a generic fallback error state, so this function
 *     never fails silently.
 *
 * @param {ConfigLoadError|Error|{valid: false, errors: Array<{field: string, message: string}>}|Array<{field: string, message: string}>} errorOrResult
 */
export function reportConfigError(errorOrResult) {
  const isConfigLoadFailure =
    errorOrResult instanceof ConfigLoadError ||
    (errorOrResult && errorOrResult.type === 'CONFIG_LOAD_FAILURE');

  if (isConfigLoadFailure) {
    reportConfigLoadError(errorOrResult);
    return;
  }

  if (Array.isArray(errorOrResult)) {
    reportFieldValidationErrors(errorOrResult);
    return;
  }

  if (errorOrResult && Array.isArray(errorOrResult.errors)) {
    reportFieldValidationErrors(errorOrResult.errors);
    return;
  }

  reportUnknownConfigError();
}

export default reportConfigError;
