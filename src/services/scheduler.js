/**
 * Scheduler Service
 * Manages task registration and scheduling using node-schedule
 */
import schedule from 'node-schedule';
import { logger } from '../utils/logger.js';
import { validateCronExpression } from '../utils/cron-validator.js';

// Store registered tasks with job references
const registeredTasks = new Map();

// Maximum execution history entries to keep per task
const MAX_HISTORY_ENTRIES = 10;

// Scheduler state
let schedulerRunning = false;

// Store the executor callback for task execution
let executorCallback = null;

/**
 * Register a task for scheduling
 * @param {object} task - Task configuration
 * @param {string} task.name - Task name
 * @param {string} task.schedule - 6-field cron expression
 * @param {Array} task.actions - Array of actions to execute
 * @param {Function} [onTrigger] - Callback when task triggers
 * @returns {object} Registration result
 */
function registerTask(task, onTrigger) {
  if (!task.name) {
    return { success: false, error: 'Task name is required' };
  }

  const cronResult = validateCronExpression(task.schedule);
  if (!cronResult.valid) {
    return { success: false, error: cronResult.error };
  }

  // Create actual scheduled job using node-schedule
  const job = schedule.scheduleJob(task.schedule, async () => {
    logger.info(`Task triggered: ${task.name}`);
    if (onTrigger) {
      await onTrigger(task);
    }
  });

  if (!job) {
    return { success: false, error: 'Failed to schedule job' };
  }

  // Store task with job reference for later cancellation
  registeredTasks.set(task.name, {
    name: task.name,
    schedule: task.schedule,
    actions: task.actions,
    job: job,
    nextRun: job.nextInvocation(),
    lastRunStatus: null,
    lastRunTime: null,
    lastError: null,
    failureCount: 0,
    executionHistory: []
  });

  logger.info(`Task registered: ${task.name}, next run: ${job.nextInvocation()}`);

  return { success: true, nextRun: job.nextInvocation() };
}

/**
 * Get list of registered tasks
 * @returns {Array} Array of registered task objects
 */
function getRegisteredTasks() {
  return Array.from(registeredTasks.values());
}

/**
 * Get next run times for all registered tasks
 * @returns {Map} Map of task names to next run dates
 */
function getNextRunTimes() {
  const times = new Map();
  for (const [name, task] of registeredTasks) {
    times.set(name, task.nextRun);
  }
  return times;
}

/**
 * Clear all registered tasks (for testing)
 * Cancels all scheduled jobs before clearing
 */
function clearTasks() {
  for (const [name, task] of registeredTasks) {
    if (task.job) {
      task.job.cancel();
    }
  }
  registeredTasks.clear();
  schedulerRunning = false;
}

/**
 * Start the scheduler with an array of tasks
 * @param {Array} tasks - Array of task configurations
 * @param {Function} executor - Function to execute when task triggers
 * @returns {object} Result with success flag and task count
 */
function startScheduler(tasks, executor) {
  // Store executor callback for use in setTaskEnabled
  executorCallback = executor;

  let registeredCount = 0;

  for (const task of tasks) {
    const result = registerTask(task, executor);
    if (result.success) {
      registeredCount++;
      logger.info(`Next run for ${task.name}: ${result.nextRun}`);
    } else {
      logger.warn(`Failed to register task ${task.name}: ${result.error}`);
    }
  }

  schedulerRunning = true;
  return { success: true, taskCount: registeredCount };
}

/**
 * Stop the scheduler and cancel all scheduled jobs
 */
function stopScheduler() {
  for (const [name, task] of registeredTasks) {
    if (task.job) {
      task.job.cancel();
      logger.info(`Cancelled job: ${name}`);
    }
  }
  registeredTasks.clear();
  schedulerRunning = false;
}

/**
 * Get scheduler statistics
 * @returns {object} Stats with running status and task count
 */
function getSchedulerStats() {
  return {
    running: schedulerRunning,
    taskCount: registeredTasks.size
  };
}

/**
 * Check if scheduler is currently running
 * @returns {boolean}
 */
function isSchedulerRunning() {
  return schedulerRunning;
}

/**
 * Record execution with history tracking
 * @param {string} taskName - Task name
 * @param {{success: boolean, status: string, error?: string, duration: number}} result - Execution result
 * @param {number} startTime - Execution start timestamp
 * @param {number} endTime - Execution end timestamp
 */
function recordExecution(taskName, result, startTime, endTime) {
  const task = registeredTasks.get(taskName);
  if (!task) {
    logger.warn(`Task not found for execution recording: ${taskName}`);
    return;
  }

  // Validate result parameter
  if (!result || typeof result !== 'object') {
    logger.warn(`Invalid result object for task: ${taskName}`);
    return;
  }

  if (typeof result.status !== 'string') {
    logger.warn(`Invalid or missing status in result for task: ${taskName}`);
    return;
  }

  // Create execution record
  const executionRecord = {
    status: result.status,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    duration: endTime - startTime
  };

  // Add error if present
  if (result.error) {
    executionRecord.error = result.error;
  }

  // Add to history (circular buffer)
  task.executionHistory.push(executionRecord);
  if (task.executionHistory.length > MAX_HISTORY_ENTRIES) {
    task.executionHistory.shift(); // Remove oldest entry
  }

  // Increment failure count for failed executions
  if (!result.success) {
    task.failureCount++;
  }

  // Call existing updateTaskStatus for backward compatibility
  updateTaskStatus(taskName, result);

  logger.info(`Execution recorded for task: ${taskName}, status: ${result.status}, duration: ${executionRecord.duration}ms`);
}

/**
 * Update task status after execution
 * @param {string} taskName - Task name
 * @param {{success: boolean, status: string, error?: string}} result - Execution result
 */
function updateTaskStatus(taskName, result) {
  const task = registeredTasks.get(taskName);
  if (task) {
    task.lastRunStatus = result.status;
    task.lastRunTime = new Date();
    if (result.error) {
      task.lastError = result.error;
    }
    if (task.job) {
      task.nextRun = task.job.nextInvocation();
    }
  }
}

/**
 * Get details for a single task
 * @param {string} taskName - Task name
 * @returns {object|null} Task details or null if not found
 */
function getTaskDetails(taskName) {
  const task = registeredTasks.get(taskName);
  if (!task) {
    return null;
  }
  return {
    name: task.name,
    schedule: task.schedule,
    actions: task.actions,
    nextRun: task.nextRun,
    lastRunStatus: task.lastRunStatus,
    lastRunTime: task.lastRunTime,
    lastError: task.lastError,
    failureCount: task.failureCount,
    executionHistory: task.executionHistory
  };
}

/**
 * Get scheduler status for API responses
 * Alias for getSchedulerStats to provide consistent naming
 * @returns {{running: boolean, taskCount: number}}
 */
function getSchedulerStatus() {
  return getSchedulerStats();
}

/**
 * Get all registered jobs (alias for getRegisteredTasks)
 * Used by API to retrieve task list
 * @returns {Array} List of tasks
 */
function getJobs() {
  return getRegisteredTasks().map(task => ({
    name: task.name,
    schedule: task.schedule,
    nextRun: task.nextRun ? new Date(task.nextRun).toLocaleString() : 'Disabled',
    enabled: task.job !== null, // Task is enabled if it has an active job
    actions: task.actions,
    lastRunStatus: task.lastRunStatus,
    lastRunTime: task.lastRunTime ? new Date(task.lastRunTime).toLocaleString() : null
  }));
}

/**
 * Set task enabled/disabled state
 * @param {string} taskName - Name of the task
 * @param {boolean} enabled - Whether to enable or disable the task
 * @returns {{name: string, enabled: boolean}} Result with new state
 */
function setTaskEnabled(taskName, enabled) {
  const task = registeredTasks.get(taskName);

  if (!task) {
    throw new Error('TASK_NOT_FOUND');
  }

  if (enabled) {
    // Reschedule the task - create new job
    if (task.job) {
      task.job.cancel(); // Cancel existing job first
    }

    // Create new job with executor callback
    const taskObj = {
      name: task.name,
      schedule: task.schedule,
      actions: task.actions
    };

    const newJob = schedule.scheduleJob(task.schedule, async () => {
      logger.info(`Task triggered: ${taskName}`);
      if (executorCallback) {
        await executorCallback(taskObj);
      }
    });

    if (!newJob) {
      throw new Error('Failed to reschedule job');
    }

    task.job = newJob;
    task.nextRun = newJob.nextInvocation();

    // Emit event for WebSocket broadcast (async, with error handling)
    import('../web/websocket/broadcaster.js')
      .then(({ emitEvent }) => {
        emitEvent('task:enabled', { taskName, enabled: true });
      })
      .catch((err) => {
        logger.warn(`Failed to emit task:enabled event: ${err.message}`);
      });
  } else {
    // Cancel the job but keep the task in registry
    if (task.job) {
      task.job.cancel();
      task.job = null;
    }
    task.nextRun = null;

    // Emit event for WebSocket broadcast (async, with error handling)
    import('../web/websocket/broadcaster.js')
      .then(({ emitEvent }) => {
        emitEvent('task:disabled', { taskName, enabled: false });
      })
      .catch((err) => {
        logger.warn(`Failed to emit task:disabled event: ${err.message}`);
      });
  }

  logger.info(`Task ${taskName} ${enabled ? 'enabled' : 'disabled'}`);

  return { name: taskName, enabled };
}

/**
 * Add a new task at runtime (for CRUD operations)
 * @param {object} task - Task configuration
 * @returns {object} Registration result
 */
function addTask(task) {
  // Check if task already exists
  if (registeredTasks.has(task.name)) {
    return { success: false, error: `Task '${task.name}' already exists` };
  }

  // Register the task with the stored executor callback
  const result = registerTask(task, executorCallback);

  if (result.success) {
    // Emit WebSocket event
    import('../web/websocket/broadcaster.js')
      .then(({ emitEvent }) => {
        emitEvent('task:created', { task: task.name, schedule: task.schedule });
      })
      .catch((err) => {
        logger.warn(`Failed to emit task:created event: ${err.message}`);
      });
  }

  return result;
}

/**
 * Update an existing task at runtime
 * @param {string} taskName - Name of task to update
 * @param {object} updatedTask - Updated task configuration
 * @returns {object} Update result
 */
function updateTaskConfig(taskName, updatedTask) {
  const existingTask = registeredTasks.get(taskName);

  if (!existingTask) {
    return { success: false, error: `Task '${taskName}' not found` };
  }

  // Cancel existing job
  if (existingTask.job) {
    existingTask.job.cancel();
  }

  // Remove old task entry
  registeredTasks.delete(taskName);

  // Register updated task
  const result = registerTask(updatedTask, executorCallback);

  if (result.success) {
    // Emit WebSocket event
    import('../web/websocket/broadcaster.js')
      .then(({ emitEvent }) => {
        emitEvent('task:updated', {
          oldName: taskName,
          task: updatedTask.name,
          schedule: updatedTask.schedule
        });
      })
      .catch((err) => {
        logger.warn(`Failed to emit task:updated event: ${err.message}`);
      });
  }

  return result;
}

/**
 * Remove a task at runtime
 * @param {string} taskName - Name of task to remove
 * @returns {object} Removal result
 */
function removeTask(taskName) {
  const task = registeredTasks.get(taskName);

  if (!task) {
    return { success: false, error: `Task '${taskName}' not found` };
  }

  // Cancel the job
  if (task.job) {
    task.job.cancel();
  }

  // Remove from registry
  registeredTasks.delete(taskName);

  logger.info(`Task removed: ${taskName}`);

  // Emit WebSocket event
  import('../web/websocket/broadcaster.js')
    .then(({ emitEvent }) => {
      emitEvent('task:deleted', { task: taskName });
    })
    .catch((err) => {
      logger.warn(`Failed to emit task:deleted event: ${err.message}`);
    });

  return { success: true };
}

export {
  registerTask,
  getRegisteredTasks,
  getNextRunTimes,
  clearTasks,
  startScheduler,
  stopScheduler,
  getSchedulerStats,
  getSchedulerStatus,
  isSchedulerRunning,
  updateTaskStatus,
  getTaskDetails,
  recordExecution,
  getJobs,
  setTaskEnabled,
  addTask,
  updateTaskConfig,
  removeTask
};
