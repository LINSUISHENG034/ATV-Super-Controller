/**
 * Executor Service
 * Executes task action chains on the device
 */
import { logger, logTaskStart, logTaskComplete, logTaskFailed } from '../utils/logger.js';
import { getAction } from '../actions/index.js';
import { emitEvent } from '../web/websocket/broadcaster.js';

// Retry configuration constants (NFR6: Max 3 retries)
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const BACKOFF_MULTIPLIER = 2; // Exponential backoff base

// Global activity log
const activityLog = [];
const MAX_ACTIVITY_LOG = 20;

// Global action context (set at startup, used by executeAction for Web API calls)
let actionContext = {};

/**
 * Get recent activity log
 * @returns {Array} List of recent activities
 */
function getActivityLog() {
  return [...activityLog].reverse(); // Newest first
}

/**
 * Add entry to activity log
 * @param {string} message - Activity message
 * @param {'INFO'|'ERROR'|'WARN'} type - Log type
 */
function addActivityLog(message, type = 'INFO') {
  const entry = {
    time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    timestamp: Date.now(),
    type,
    message
  };
  
  activityLog.push(entry);
  if (activityLog.length > MAX_ACTIVITY_LOG) {
    activityLog.shift();
  }
}

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
 * @param {object} [context={}] - Context object with config (e.g., { youtube: {...} })
 * @returns {{success: boolean, status: 'completed'|'failed', results: Array<{action: string, success: boolean, duration: number, retryCount?: number}>, duration: number, error?: string, failedAtIndex?: number, failedAction?: string}} Execution result with status, duration, and action results
 */
async function executeTask(task, device, context = {}) {
  const startTime = Date.now();

  // Task 2.1: Add task start log in executor.js with taskName and actions
  logTaskStart(task.name, task.actions || []);
  addActivityLog(`Started: ${task.name}`, 'INFO');

  // Emit task:triggered event for WebSocket broadcast
  emitEvent('task:triggered', {
    taskName: task.name,
    triggeredAt: new Date().toISOString(),
    triggerType: 'manual'
  });

  if (!task.actions || task.actions.length === 0) {
    logger.warn(`Task '${task.name}' has no actions to execute`);
  }

  const results = [];

  for (let i = 0; i < task.actions.length; i++) {
    const actionDef = task.actions[i];
    const action = getAction(actionDef.type);

    if (!action) {
      logger.error(`Unknown action type: ${actionDef.type}`);
      const duration = Date.now() - startTime;

      // Task 2.2: Add task failure log with duration and result status
      logTaskFailed(task.name, duration, `Unknown action: ${actionDef.type}`, 0);

      return {
        success: false,
        status: 'failed',
        error: `Unknown action: ${actionDef.type}`,
        failedAtIndex: i,
        results,
        duration
      };
    }

    // Task 2.3: Add action-level logging (start/complete for each action)
    logger.info(`Executing action: ${actionDef.type}`);
    const actionStart = Date.now();

    try {
      const { result, retryCount } = await retryWithBackoff(() => action.execute(device, actionDef, context));

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

      // Task 2.3: Log action completion
      logger.info(`Action completed: ${actionDef.type}`, {
        action: actionDef.type,
        duration: actionResult.duration,
        retryCount: retryCount || 0
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Task 2.4: Include retry information in failure logs
      // When retryWithBackoff throws, all MAX_RETRIES attempts have been exhausted
      logTaskFailed(task.name, duration, error.message, MAX_RETRIES);
      addActivityLog(`Failed: ${task.name} (${error.message})`, 'ERROR');
      emitEvent('task:failed', { 
        task: task.name, 
        error: error.message, 
        duration 
      });

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
        duration
      };
    }
  }

  const duration = Date.now() - startTime;

  // Task 2.2: Add task completion log with duration and result status
  logTaskComplete(task.name, duration, 'success');
  addActivityLog(`Completed: ${task.name}`, 'INFO');
  emitEvent('task:completed', { 
    task: task.name, 
    duration 
  });

  return {
    success: true,
    status: 'completed',
    results,
    duration
  };
}

/**
 * Execute a single action directly
 * @param {object} device - ADB device object
 * @param {string} actionName - Name of action to execute
 * @param {object} [params={}] - Action parameters
 * @returns {Promise<object>} Execution result
 */
async function executeAction(device, actionName, params = {}) {
  // Construct a temporary task for execution
  const task = {
    name: `Direct Action: ${actionName}`,
    actions: [{ type: actionName, ...params }]
  };
  
  // Use the global context (contains youtube config etc.)
  return await executeTask(task, device, actionContext);
}

/**
 * Set the action context for Web API calls
 * Called at startup to provide youtube config etc.
 * @param {object} context - Context object with config
 */
function setActionContext(context) {
  actionContext = context || {};
}

/**
 * Get the current action context
 * @returns {object} Current context
 */
function getActionContext() {
  return actionContext;
}

export { executeTask, retryWithBackoff, getRetryConfig, executeAction, getActivityLog, setActionContext, getActionContext };
