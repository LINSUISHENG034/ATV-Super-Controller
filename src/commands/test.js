/**
 * Test command - manually trigger action or task
 */
import { getAction, listActions } from '../actions/index.js';
import { loadConfig } from '../utils/config.js';
import { connect, getDevice, disconnect } from '../services/adb-client.js';
import { logger } from '../utils/logger.js';
import { executeTask } from '../services/executor.js';

/**
 * Execute a specific action or configured task for testing
 * @param {string} name - Action name (wake-up, launch-app, play-video, shutdown) or configured task name
 * @param {object} options - CLI options
 * @param {string} [options.url] - YouTube URL for play-video action
 * @param {string} [options.app] - App package for launch-app action
 * @param {string} [options.config] - Path to config file
 */
export async function testCommand(name, options) {
  // 1. Validate input
  if (!name) {
    console.error('Error: Action or task name required');
    console.log(`Available actions: ${listActions().join(', ')}`);
    process.exit(1);
  }

  // 2. Load config
  let config;
  try {
    config = await loadConfig(options.config);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  // 3. Check for action first, then task in config
  let action = getAction(name);
  let params = {};
  let task = null;

  if (!action) {
    // Look for task in config
    task = config.tasks?.find(t => t.name === name);
    if (!task) {
      console.error(`Task not found: ${name}`);
      console.log(`Available actions: ${listActions().join(', ')}`);
      process.exit(1);
    }
  }

  // 4. Build params from options
  if (options.url) params.url = options.url;
  if (options.app) params.package = options.app;

  // 5. Connect to device
  const result = await connect(config.device.ip, config.device.port);
  if (!result.connected) {
    console.error(`Connection failed: ${result.error.message}`);
    process.exit(1);
  }

  // 6. Execute action or task
  const device = getDevice();
  const context = { youtube: config.youtube };

  let execResult;
  try {
    if (task) {
      // Execute full task with action chain
      logger.info(`Executing task: ${task.name}`, { actions: task.actions.length });
      execResult = await executeTask(task, device, context);
    } else {
      // Execute single action
      logger.info(`Executing action: ${action.name}`, { params });
      const actionResult = await action.execute(device, params, context);
      execResult = {
        success: actionResult.success,
        message: actionResult.message,
        error: actionResult.error,
        actionName: action.name
      };
    }
  } finally {
    await disconnect();
  }

  // 7. Display result
  if (execResult.success) {
    if (task) {
      console.log(`✓ Task '${task.name}' completed successfully`);
      console.log(`  Actions: ${execResult.results.length}, Duration: ${execResult.duration}ms`);
    } else {
      console.log(`✓ ${execResult.actionName}: ${execResult.message}`);
    }
    process.exit(0);
  } else {
    if (task) {
      console.error(`✗ Task '${task.name}' failed: ${execResult.error}`);
      if (execResult.failedAction) {
        console.error(`  Failed at action: ${execResult.failedAction}`);
      }
    } else {
      console.error(`✗ ${execResult.actionName}: ${execResult.error?.message || execResult.error}`);
    }
    process.exit(1);
  }
}
