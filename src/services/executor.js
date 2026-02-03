/**
 * Executor Service
 * Executes task action chains on the device
 */
import { logger } from '../utils/logger.js';
import { getAction } from '../actions/index.js';

// Retry configuration constants (NFR6: Max 3 retries)
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const BACKOFF_MULTIPLIER = 2; // Exponential backoff base

/**
 * Get retry configuration values
 * @returns {{maxRetries: number, initialDelay: number, backoffMultiplier: number}}
 */
function getRetryConfig() {
  return {
    maxRetries: MAX_RETRIES,
    initialDelay: INITIAL_DELAY,
    backoffMultiplier: BACKOFF_MULTIPLIER
  };
}

/**
 * Sleep helper function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 1000)
 * @returns {Promise<{result: any, retryCount: number}>} Result with retry count
 * @throws {Error} Last error after all retries exhausted
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, initialDelay = INITIAL_DELAY) {
  let lastError;
  let retryCount = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retryCount };
    } catch (error) {
      lastError = error;
      retryCount = attempt + 1;
      const delay = initialDelay * Math.pow(BACKOFF_MULTIPLIER, attempt);

      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
        error: error.message
      });

      if (attempt < maxRetries - 1) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Execute a task's action chain
 * @param {object} task - Task with actions array
 * @param {object} device - ADB device object
 * @returns {{success: boolean, status: 'completed'|'failed', results: Array<{action: string, success: boolean, duration: number, retryCount?: number}>, duration: number, error?: string, failedAtIndex?: number, failedAction?: string}} Execution result with status, duration, and action results
 */
async function executeTask(task, device) {
  const startTime = Date.now();
  logger.info(`Executing task: ${task.name}`);

  if (!task.actions || task.actions.length === 0) {
    logger.warn(`Task '${task.name}' has no actions to execute`);
  }

  const results = [];

  for (let i = 0; i < task.actions.length; i++) {
    const actionDef = task.actions[i];
    const action = getAction(actionDef.type);

    if (!action) {
      logger.error(`Unknown action type: ${actionDef.type}`);
      return {
        success: false,
        status: 'failed',
        error: `Unknown action: ${actionDef.type}`,
        failedAtIndex: i,
        results,
        duration: Date.now() - startTime
      };
    }

    logger.info(`Executing action: ${actionDef.type}`);
    const actionStart = Date.now();

    try {
      const { result, retryCount } = await retryWithBackoff(() => action.execute(device, actionDef));

      if (!result.success) {
        throw new Error(result.error || 'Action returned failure');
      }

      const actionResult = {
        action: actionDef.type,
        success: true,
        duration: Date.now() - actionStart
      };
      if (retryCount > 0) {
        actionResult.retryCount = retryCount;
      }
      results.push(actionResult);
    } catch (error) {
      logger.error(`Action failed after ${MAX_RETRIES} retries: ${actionDef.type}`, {
        task: task.name,
        action: actionDef.type,
        error: error.message
      });

      return {
        success: false,
        status: 'failed',
        error: error.message,
        failedAtIndex: i,
        failedAction: actionDef.type,
        results,
        duration: Date.now() - startTime
      };
    }
  }

  logger.info(`Task '${task.name}' completed successfully`);
  return {
    success: true,
    status: 'completed',
    results,
    duration: Date.now() - startTime
  };
}

export { executeTask, retryWithBackoff, getRetryConfig };
