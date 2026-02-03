/**
 * Start command - starts the scheduler service
 */
import { loadConfig } from '../utils/config.js';
import { connect, disconnect, getDevice } from '../services/adb-client.js';
import { startScheduler, stopScheduler } from '../services/scheduler.js';
import { executeTask } from '../services/executor.js';
import { logger } from '../utils/logger.js';

/**
 * Graceful shutdown handler
 * @param {string} signal - Signal received (SIGINT or SIGTERM)
 */
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);

  stopScheduler();
  await disconnect();

  logger.info('Scheduler stopped');
  process.exit(0);
}

/**
 * Start the scheduler service
 * Loads config, connects to device, and starts task scheduling
 */
export async function startCommand() {
  try {
    // Load configuration
    const config = await loadConfig();

    // Connect to device
    const result = await connect(config.device.ip, config.device.port);
    if (!result.connected) {
      logger.error(`Failed to connect to device: ${result.error?.message || 'Unknown error'}`);
      process.exit(1);
    }

    // Get device for task execution
    const device = getDevice();

    // Task executor callback
    const executor = async (task) => {
      await executeTask(task, device);
    };

    // Start scheduler with all tasks
    const schedulerResult = startScheduler(config.tasks || [], executor);

    logger.info(`Scheduler started with ${schedulerResult.taskCount} tasks`);

    // Register signal handlers for graceful shutdown
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Process stays alive because node-schedule keeps the event loop busy
  } catch (error) {
    if (error.code === 'CONFIG_NOT_FOUND') {
      logger.error('Configuration file not found');
    } else {
      logger.error(`Startup failed: ${error.message}`);
    }
    process.exit(1);
  }
}
