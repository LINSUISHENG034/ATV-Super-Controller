/**
 * Start command - starts the scheduler service
 */
import { loadConfig } from '../utils/config.js';
import { connect, disconnect, getDevice } from '../services/adb-client.js';
import { startScheduler, stopScheduler, recordExecution } from '../services/scheduler.js';
import { executeTask, setActionContext } from '../services/executor.js';
import { logger } from '../utils/logger.js';
import { WebServer } from '../web/server.js';

let webServer = null;

/**
 * Graceful shutdown handler
 * @param {string} signal - Signal received (SIGINT or SIGTERM)
 */
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);

  // Stop web server first (closes WebSocket connections)
  if (webServer) {
    await webServer.stop();
    webServer = null;
  }

  stopScheduler();
  await disconnect();

  logger.info('Scheduler stopped');
  process.exit(0);
}

/**
 * Start the scheduler service
 * Loads config, connects to device, and starts task scheduling
 * @param {object} options - Command options from commander
 * @param {boolean} [options.web] - Enable Web UI server
 * @param {string|number} [options.webPort] - Web server port
 */
export async function startCommand(options = {}) {
  try {
    // Load configuration
    const config = await loadConfig();

    // Check if web server should be enabled
    const webEnabled = options.web || process.env.ATV_WEB_ENABLED === 'true';
    const webPort = options.webPort || parseInt(process.env.ATV_WEB_PORT || '3000', 10);

    // Connect to device
    const result = await connect(config.device.ip, config.device.port);
    if (!result.connected) {
      logger.error(`Failed to connect to device: ${result.error?.message || 'Unknown error'}`);
      process.exit(1);
    }

    // Get device for task execution
    const device = getDevice();

    // Build context for actions (e.g., play-video needs youtube config)
    const context = {
      youtube: config.youtube
    };

    // Set global context for Web API calls (executeAction uses this)
    setActionContext(context);

    // Task executor callback
    const executor = async (task) => {
      const startTime = Date.now();
      const result = await executeTask(task, device, context);
      const endTime = Date.now();
      recordExecution(task.name, result, startTime, endTime);
    };

    // Start scheduler with all tasks
    const schedulerResult = startScheduler(config.tasks || [], executor);

    logger.info(`Scheduler started with ${schedulerResult.taskCount} tasks`);

    // Start web server if enabled
    if (webEnabled) {
      webServer = new WebServer({ port: webPort });
      await webServer.start();
      logger.info(`Web UI enabled on port ${webPort}`);
    }

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
