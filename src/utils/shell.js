/**
 * Shell Utilities
 * Shared helpers for safe shell command construction.
 */

/**
 * Valid Android package name pattern
 * Must start with letter, contain only alphanumeric, dots, and underscores
 */
const PACKAGE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9._]*$/;

/**
 * Escape a value for safe single-quoted shell usage
 * @param {string} value - Raw argument value
 * @returns {string} Shell-safe single-quoted string
 */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Validate Android package name format
 * @param {string} packageName - Package identifier
 * @returns {boolean} True if valid
 */
function isValidPackageName(packageName) {
  return packageName && PACKAGE_NAME_PATTERN.test(packageName);
}

export { shellQuote, isValidPackageName, PACKAGE_NAME_PATTERN };
