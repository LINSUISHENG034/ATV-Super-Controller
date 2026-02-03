/**
 * Scheduler Service
 * Manages task registration and scheduling using node-schedule
 * Note: Actual job scheduling will be implemented in Story 3-2
 */
import { logger } from '../utils/logger.js';
import { validateCronExpression } from '../utils/cron-validator.js';

// Store registered tasks
const registeredTasks = new Map();

/**
 * Register a task for scheduling
 * @param {object} task - Task configuration
 * @param {string} task.name - Task name
 * @param {string} task.schedule - 6-field cron expression
 * @param {Array} task.actions - Array of actions to execute
 * @returns {object} Registration result
 */
function registerTask(task) {
  if (!task.name) {
    return { success: false, error: 'Task name is required' };
  }

  const cronResult = validateCronExpression(task.schedule);
  if (!cronResult.valid) {
    return { success: false, error: cronResult.error };
  }

  // Store task (stub - actual scheduling in Story 3-2)
  registeredTasks.set(task.name, {
    name: task.name,
    schedule: task.schedule,
    actions: task.actions,
    nextRun: cronResult.nextRun
  });

  logger.info(`Task registered: ${task.name}, next run: ${cronResult.nextRun}`);

  return { success: true, nextRun: cronResult.nextRun };
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
 */
function clearTasks() {
  registeredTasks.clear();
}

export { registerTask, getRegisteredTasks, getNextRunTimes, clearTasks };
