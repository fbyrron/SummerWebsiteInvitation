// configLoader.js
// Config-source-load-failure detection (Task 2.2 in design.md's Error Scenario 4 /
// Requirement 6.3).
//
// This module owns exactly one concern: can the EventConfig *source* be loaded
// and parsed at all? It does NOT perform field-level validation (childName
// length, age range, etc.) - that is a separate concern implemented by Task 2.2
// ("field-level validation") and reported via Task 2.4's error reporting. This
// separation matters because Requirement 6.3/6.4 and design.md's Error Scenario
// 3 vs. 4 require the two failure modes to be distinguishable:
//
//   - Error Scenario 4 (this file): the config source itself cannot be
//     loaded/parsed (missing module, syntax error, non-object export).
//   - Error Scenario 3 (task 2.2/2.4): the config loaded fine, but one or more
//     fields fail validation rules.
//
// loadEventConfig() below must run, and fail/succeed, BEFORE any field-level
// validation is attempted. Callers should call loadEventConfig() first; only
// on success should they pass the result to the (separately implemented)
// field validator.

const CONFIG_MODULE_PATH = './eventConfig.js';

/**
 * Distinct, observable error type for a config-source-load-failure, kept
 * separate from field-validation errors so callers (main.js, wired in Task 9)
 * can branch on `error.type === 'CONFIG_LOAD_FAILURE'` or
 * `error instanceof ConfigLoadError`.
 */
export class ConfigLoadError extends Error {
  /**
   * @param {string} message
   * @param {unknown} [cause] - the underlying import/parse error, if any.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'ConfigLoadError';
    this.type = 'CONFIG_LOAD_FAILURE';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * @param {unknown} value
 * @returns {boolean} true if value is a non-null, non-array object.
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Loads the EventConfig source module and returns its exported `EventConfig`
 * object. This function concerns itself ONLY with whether the source could be
 * loaded and parsed into a usable object - not whether the fields within it
 * are individually valid (that is a separate, later step; see module header).
 *
 * Failure cases that all surface as a `ConfigLoadError` (never a plain/native
 * error, so the failure is reliably observable and distinguishable):
 *   - The module fails to import (missing file, network failure when served,
 *     or a JS syntax/parse error in the source file itself).
 *   - The module imports successfully but has no `EventConfig` export, or the
 *     export is not an object (e.g. undefined, null, a string, an array).
 *
 * @returns {Promise<Record<string, unknown>>} the loaded EventConfig object.
 * @throws {ConfigLoadError} when the source cannot be loaded or parsed.
 */
export async function loadEventConfig() {
  let loadedModule;

  try {
    // Dynamic import surfaces both "module not found" and "syntax/parse
    // error in the module" as a rejected promise, which is exactly the
    // load/parse failure this function needs to detect.
    loadedModule = await import(CONFIG_MODULE_PATH);
  } catch (cause) {
    throw new ConfigLoadError('Configuration could not be loaded', cause);
  }

  const config = loadedModule ? loadedModule.EventConfig : undefined;

  if (!isPlainObject(config)) {
    throw new ConfigLoadError('Configuration could not be loaded');
  }

  return config;
}
