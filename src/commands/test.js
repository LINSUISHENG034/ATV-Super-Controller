/**
 * Test command - manually trigger action or task
 */
import { getAction, listActions } from '../actions/index.js';
import { loadConfig } from '../utils/config.js';
import { connect, getDevice, disconnect } from '../services/adb-client.js';
import { logger } from '../utils/logger.js';

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

  if (!action) {
    // Look for task in config
    const task = config.tasks?.find(t => t.name === name);
    if (task) {
      action = getAction(task.action.type);
      params = task.action;
    }
  }

  if (!action) {
    console.error(`Task not found: ${name}`);
    console.log(`Available actions: ${listActions().join(', ')}`);
    process.exit(1);
  }

  // 4. Build params from options
  if (options.url) params.url = options.url;
  if (options.app) params.app = options.app;

  // 5. Connect to device
  const result = await connect(config.device.ip, config.device.port);
  if (!result.connected) {
    console.error(`Connection failed: ${result.error.message}`);
    process.exit(1);
  }

  // 6. Execute action
  const device = getDevice();
  logger.info(`Executing action: ${action.name}`, { params });

  let actionResult;
  try {
    actionResult = await action.execute(device, params);
  } finally {
    await disconnect();
  }

  // 7. Display result
  if (actionResult.success) {
    console.log(`✓ ${action.name}: ${actionResult.message}`);
    if (actionResult.data) {
      console.log('  Details:', JSON.stringify(actionResult.data, null, 2));
    }
    process.exit(0);
  } else {
    console.error(`✗ ${action.name}: ${actionResult.error.message}`);
    if (actionResult.error.details) {
      console.error('  Details:', JSON.stringify(actionResult.error.details, null, 2));
    }
    process.exit(1);
  }
}
