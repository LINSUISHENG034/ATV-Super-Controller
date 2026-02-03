/**
 * Executor Service
 * Executes task action chains on the device
 */
import { logger } from '../utils/logger.js';
import { getAction } from '../actions/index.js';

/**
 * Execute a task's action chain
 * @param {object} task - Task with actions array
 * @param {object} device - ADB device object
 * @returns {object} Execution result
 */
async function executeTask(task, device) {
  logger.info(`Executing task: ${task.name}`);

  for (const actionDef of task.actions) {
    const action = getAction(actionDef.type);
    if (!action) {
      logger.error(`Unknown action type: ${actionDef.type}`);
      return { success: false, error: `Unknown action: ${actionDef.type}` };
    }

    logger.info(`Executing action: ${actionDef.type}`);
    const result = await action.execute(device, actionDef);

    if (!result.success) {
      logger.error(`Action failed: ${actionDef.type}`, result.error);
      return result;
    }
  }

  logger.info(`Task completed: ${task.name}`);
  return { success: true };
}

export { executeTask };
