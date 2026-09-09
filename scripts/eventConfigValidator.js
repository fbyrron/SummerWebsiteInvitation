// eventConfigValidator.js
// Field-level validation for an already-loaded EventConfig object (Task 2.2).
//
// This module owns exactly one concern: given an EventConfig object that has
// ALREADY been successfully loaded/parsed (see configLoader.js's
// loadEventConfig(), Task 2.3), check whether each field satisfies the
// validation rules in design.md's "Model 1: EventConfig" and
// requirements.md Requirement 6.2/6.5. It does NOT load, import, or parse a
// config source - that is configLoader.js's job and must run first. Keeping
// these concerns separate lets callers distinguish a "configuration could
// not be loaded" error (Error Scenario 4) from a "field(s) failed
// validation" error (Error Scenario 3), per Requirement 6.3/6.4.
//
// Requirements: 2.3, 6.2, 6.5

/**
 * eventTime format: "H:MM AM/PM" or "HH:MM AM/PM", case-insensitive, with an
 * optional space before AM/PM (e.g. "2:00 PM", "11:45am", "9:05 AM").
 * Hours 1-12, minutes 00-59. This matches the format used throughout
 * eventConfig.js (e.g. '2:00 PM') and is the "reasonable, recognizable time
 * format" this validator checks against.
 */
const EVENT_TIME_PATTERN = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;

/**
 * eventDate format: strict "YYYY-MM-DD" calendar date, matching the format
 * used in eventConfig.js. Validated further below by checking the parsed
 * components round-trip (guards against rollover dates like 2025-02-30).
 */
const EVENT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @param {unknown} value
 * @returns {boolean} true if value is a string with at least one non-whitespace character.
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean} true if value is undefined, null, or an empty/whitespace-only string.
 */
function isAbsentOrEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0);
}

/**
 * Validates a required, non-empty string field with a max length.
 * @returns {string|null} an error message, or null if valid.
 */
function validateRequiredString(value, maxLength) {
  if (!isNonEmptyString(value)) {
    return 'must be a non-empty string';
  }
  if (value.length > maxLength) {
    return `must be at most ${maxLength} characters`;
  }
  return null;
}

/**
 * Validates an optional string field with a max length (valid when absent/empty).
 * @returns {string|null} an error message, or null if valid.
 */
function validateOptionalString(value, maxLength) {
  if (isAbsentOrEmpty(value)) {
    return null;
  }
  if (typeof value !== 'string') {
    return 'must be a string';
  }
  if (value.length > maxLength) {
    return `must be at most ${maxLength} characters`;
  }
  return null;
}

/**
 * Resolves the UTC calendar-day components (year, month, day) representing
 * "today" at validation time - i.e. the build date, per design.md's
 * "on or after the build date" rule. UTC is used consistently here and in
 * parseEventDateAsUtcDay() below so that a plain "YYYY-MM-DD" eventDate
 * string (which JS parses as UTC midnight) is compared on equal terms,
 * regardless of the machine's local timezone offset.
 * @returns {number} milliseconds since epoch for today's UTC midnight.
 */
function todayAsUtcMidnightMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Parses a "YYYY-MM-DD" eventDate string (or a Date instance) into UTC
 * midnight milliseconds, validating that it is a real calendar date
 * (rejects rollover values like "2025-02-30").
 * @param {unknown} value
 * @returns {number|null} UTC midnight ms, or null if not a valid calendar date.
 */
function parseEventDateAsUtcDay(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return null;
    }
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = EVENT_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);

  // Guard against rollover (e.g. 2025-02-30 -> would roll to March):
  // re-derive the components from the constructed date and require an
  // exact match.
  const roundTrip = new Date(ms);
  const isExactMatch =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day;

  return isExactMatch ? ms : null;
}

/**
 * Validates an already-loaded EventConfig object against the field-level
 * rules in design.md's "Model 1: EventConfig" / Requirement 6.2 & 6.5.
 * Collects ALL failing fields in a single pass (rather than stopping at the
 * first failure) so error reporting (Task 2.4) can list every failure.
 *
 * @param {Record<string, unknown>} config
 * @returns {{valid: true} | {valid: false, errors: Array<{field: string, message: string}>}}
 */
export function validateEventConfig(config) {
  const errors = [];

  function addError(field, message) {
    errors.push({ field, message });
  }

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: [{ field: 'config', message: 'must be a non-null object' }] };
  }

  // childName: non-empty string, <=100 chars
  {
    const message = validateRequiredString(config.childName, 100);
    if (message) addError('childName', message);
  }

  // age: integer, 1-120 inclusive
  {
    const value = config.age;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      addError('age', 'must be an integer');
    } else if (value < 1 || value > 120) {
      addError('age', 'must be between 1 and 120 inclusive');
    }
  }

  // venueName: non-empty string, <=200 chars
  {
    const message = validateRequiredString(config.venueName, 200);
    if (message) addError('venueName', message);
  }

  // venueAddress: non-empty string, <=200 chars
  {
    const message = validateRequiredString(config.venueAddress, 200);
    if (message) addError('venueAddress', message);
  }

  // rsvpContact: non-empty string, <=200 chars
  {
    const message = validateRequiredString(config.rsvpContact, 200);
    if (message) addError('rsvpContact', message);
  }

  // themeNote: non-empty string, <=200 chars
  {
    const message = validateRequiredString(config.themeNote, 200);
    if (message) addError('themeNote', message);
  }

  // mapLink: optional, <=500 chars if present
  {
    const message = validateOptionalString(config.mapLink, 500);
    if (message) addError('mapLink', message);
  }

  // giftNote: optional, <=280 chars if present
  {
    const message = validateOptionalString(config.giftNote, 280);
    if (message) addError('giftNote', message);
  }

  // rsvpLink: optional, <=500 chars if present
  {
    const message = validateOptionalString(config.rsvpLink, 500);
    if (message) addError('rsvpLink', message);
  }

  // eventDate: valid calendar date, on or after the build date (today, at validation time)
  {
    const eventDayMs = parseEventDateAsUtcDay(config.eventDate);
    if (eventDayMs === null) {
      addError('eventDate', 'must be a valid calendar date (YYYY-MM-DD)');
    } else if (eventDayMs < todayAsUtcMidnightMs()) {
      addError('eventDate', 'must be on or after the build date');
    }
  }

  // eventTime: valid time value (H:MM AM/PM format)
  {
    if (typeof config.eventTime !== 'string' || !EVENT_TIME_PATTERN.test(config.eventTime.trim())) {
      addError('eventTime', 'must be a valid time in "H:MM AM/PM" format (e.g. "2:00 PM")');
    }
  }

  // message: optional, <=280 chars if present
  {
    const message = validateOptionalString(config.message, 280);
    if (message) addError('message', message);
  }

  // themeColors: array with at least 1 element
  {
    if (!Array.isArray(config.themeColors) || config.themeColors.length < 1) {
      addError('themeColors', 'must be an array with at least 1 color');
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

export default validateEventConfig;
