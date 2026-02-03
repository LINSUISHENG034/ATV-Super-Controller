/**
 * Winston logger module
 * Provides structured JSON logging with configurable log levels
 */
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.ATV_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Log with context object merged into JSON output
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message
 * @param {object} context - Context object with additional fields
 */
function logWithContext(level, message, context = {}) {
  logger.log(level, message, context);
}

/**
 * Log task start with context
 * @param {string} taskName - Name of the task
 * @param {Array} actions - Array of actions to execute
 */
function logTaskStart(taskName, actions) {
  logWithContext('info', 'Task started', { taskName, actionCount: actions.length });
}

/**
 * Log task completion with context
 * @param {string} taskName - Name of the task
 * @param {number} duration - Task duration in milliseconds
 * @param {string} result - Task result (success/failed)
 */
function logTaskComplete(taskName, duration, result) {
  logWithContext('info', 'Task completed', { taskName, duration, result });
}

/**
 * Log task failure with context
 * @param {string} taskName - Name of the task
 * @param {number} duration - Task duration in milliseconds
 * @param {string} error - Error message
 * @param {number} retryCount - Number of retries attempted
 */
function logTaskFailed(taskName, duration, error, retryCount) {
  logWithContext('error', 'Task failed', { taskName, duration, error, retryCount });
}

/**
 * Log ADB command at debug level
 * @param {string} command - ADB command string
 * @param {string} device - Device target (ip:port)
 */
function logAdbCommand(command, device) {
  logWithContext('debug', 'ADB command', { command, device });
}

export { logger, logWithContext, logTaskStart, logTaskComplete, logTaskFailed, logAdbCommand };
