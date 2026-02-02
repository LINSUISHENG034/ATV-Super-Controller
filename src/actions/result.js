/**
 * Action Result Helpers
 * Standard result structure for all actions
 */

/**
 * Create a success result
 * @param {string} message - Success message
 * @param {object} [data] - Optional data payload
 * @returns {{success: true, message: string, data?: object}}
 */
function successResult(message, data) {
  const result = { success: true, message };
  if (data !== undefined) {
    result.data = data;
  }
  return result;
}

/**
 * Create an error result
 * @param {string} code - Error code (SCREAMING_SNAKE_CASE)
 * @param {string} message - Error message
 * @param {object} [details] - Optional error details
 * @returns {{success: false, error: {code: string, message: string, details?: object}}}
 */
function errorResult(code, message, details) {
  const error = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return { success: false, error };
}

export { successResult, errorResult };
