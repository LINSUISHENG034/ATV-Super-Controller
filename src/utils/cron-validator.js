/**
 * Cron Expression Validator Module
 * Validates 6-field cron expressions using node-schedule
 */
import schedule from 'node-schedule';

/**
 * Validate a cron expression
 * @param {string} expression - 6-field cron expression
 * @returns {object} { valid: true, nextRun: Date } or { valid: false, error: string }
 */
function validateCronExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    return { valid: false, error: 'Cron expression must be a non-empty string' };
  }

  const trimmed = expression.trim();
  if (!trimmed) {
    return { valid: false, error: 'Cron expression must be a non-empty string' };
  }

  // Enforce 6-field cron format (with seconds)
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 6) {
    return {
      valid: false,
      error: `Invalid cron expression: expected 6 fields (with seconds), got ${fields.length}`
    };
  }

  try {
    const job = schedule.scheduleJob(trimmed, () => {});
    if (job) {
      const nextRun = job.nextInvocation();
      job.cancel();
      return {
        valid: true,
        nextRun: nextRun ? nextRun.toDate() : null
      };
    }
    return { valid: false, error: 'Invalid cron expression' };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Get the next run time for a cron expression
 * @param {string} expression - 6-field cron expression
 * @returns {Date|null} Next run time or null if invalid
 */
function getNextRunTime(expression) {
  const result = validateCronExpression(expression);
  return result.valid ? result.nextRun : null;
}

export { validateCronExpression, getNextRunTime };
