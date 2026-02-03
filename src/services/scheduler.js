/**
 * Scheduler Service
 * Manages task registration and scheduling using node-schedule
 */
import schedule from 'node-schedule';
import { logger } from '../utils/logger.js';
import { validateCronExpression } from '../utils/cron-validator.js';

// Store registered tasks with job references
const registeredTasks = new Map();

// Scheduler state
let schedulerRunning = false;

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
    lastError: null
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
    lastError: task.lastError
  };
}

export {
  registerTask,
  getRegisteredTasks,
  getNextRunTimes,
  clearTasks,
  startScheduler,
  stopScheduler,
  getSchedulerStats,
  isSchedulerRunning,
  updateTaskStatus,
  getTaskDetails
};
