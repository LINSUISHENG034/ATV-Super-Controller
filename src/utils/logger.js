/**
 * Winston logger module
 * Provides structured JSON logging with configurable log levels
 * Includes in-memory log buffer for web UI retrieval
 */
import winston from 'winston';
import Transport from 'winston-transport';
import { EventEmitter } from 'events';

// Log buffer configuration
const MAX_LOG_ENTRIES = 500;
const logBuffer = [];

// Event emitter for real-time log streaming
const logEmitter = new EventEmitter();

/**
 * Custom Winston transport that captures logs to in-memory buffer
 */
class BufferTransport extends Transport {
  log(info, callback) {
    const entry = {
      timestamp: info.timestamp || new Date().toISOString(),
      level: info.level.toUpperCase(),
      message: info.message
    };

    // Add to circular buffer
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_ENTRIES) {
      logBuffer.shift();
    }

    // Emit for real-time streaming
    logEmitter.emit('log', entry);

    callback();
  }
}

const logger = winston.createLogger({
  level: process.env.ATV_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new BufferTransport()
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

/**
 * Get recent logs from buffer with optional filtering
 * @param {object} options - Filter options
 * @param {string} options.level - Filter by log level (case-insensitive)
 * @param {number} options.limit - Max entries to return (default 100, max 500)
 * @param {string} options.since - ISO timestamp to filter logs after
 * @returns {{ logs: Array, hasMore: boolean }}
 */
function getRecentLogs({ level, limit = 100, since } = {}) {
  let filtered = [...logBuffer];

  // Filter by level
  if (level && level.toLowerCase() !== 'all') {
    const upperLevel = level.toUpperCase();
    filtered = filtered.filter(log => log.level === upperLevel);
  }

  // Filter by timestamp (validate date first)
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      filtered = filtered.filter(log => new Date(log.timestamp) > sinceDate);
    }
  }

  // Apply limit (max 500)
  const effectiveLimit = Math.min(Math.max(1, limit), 500);
  const hasMore = filtered.length > effectiveLimit;
  const result = filtered.slice(-effectiveLimit);

  return { logs: result, hasMore };
}

export {
  logger,
  logWithContext,
  logTaskStart,
  logTaskComplete,
  logTaskFailed,
  logAdbCommand,
  getRecentLogs,
  logEmitter
};
