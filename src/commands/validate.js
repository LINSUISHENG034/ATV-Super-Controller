/**
 * Validate command - validates configuration file against JSON Schema
 */
import { loadConfig, validateConfig, validateTasks } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Execute validate command
 * @param {object} options - Command options
 * @param {string} options.config - Path to config file
 */
export async function validateCommand(options) {
  const configPath = options.config;

  try {
    // Load config file
    const config = await loadConfig(configPath);

    // Validate against schema
    const result = validateConfig(config);

    if (!result.valid) {
      logger.error('Configuration validation failed');
      for (const error of result.errors) {
        logger.error(`${error.path || '/'}: ${error.message}`);
        if (error.value !== undefined) {
          logger.debug(`Value: ${JSON.stringify(error.value)}`);
        }
      }
      process.exitCode = 1;
      return;
    }

    // Validate tasks (cron expressions and action types)
    const taskResult = validateTasks(config);

    if (!taskResult.valid) {
      logger.error('Configuration validation failed');
      for (const error of taskResult.errors) {
        logger.error(`${error.path || '/'}: ${error.message}`);
        if (error.value !== undefined) {
          logger.debug(`Value: ${JSON.stringify(error.value)}`);
        }
      }
      process.exitCode = 1;
      return;
    }

    logger.info('Configuration is valid');
    logger.info(`Device: ${config.device.ip}:${config.device.port}`);
    logger.info(`Tasks: ${config.tasks.length} task(s) configured`);
    process.exitCode = 0;
  } catch (error) {
    if (error.code === 'CONFIG_NOT_FOUND') {
      logger.error(error.message);
    } else if (error.code === 'CONFIG_PARSE_ERROR') {
      logger.error(error.message);
    } else {
      logger.error(`Unexpected error: ${error.message}`);
    }
    process.exitCode = 1;
  }
}
