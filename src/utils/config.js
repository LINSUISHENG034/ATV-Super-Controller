/**
 * Configuration loader and validator module
 * Handles loading config files and validating against JSON Schema
 */
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { logger } from './logger.js';
import { validateCronExpression } from './cron-validator.js';
import { getAction } from '../actions/index.js';

import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema once at module initialization
const schemaPath = join(__dirname, '../../schemas/config.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

// Initialize ajv with formats support
const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);
const validate = ajv.compile(schema);

/**
 * Load configuration from a JSON file
 * @param {string} filePath - Path to the config file
 * @returns {object} Parsed configuration object
 * @throws {Error} If file not found or invalid JSON
 */
async function loadConfigFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const err = new Error(`Configuration file not found: ${filePath}`);
      err.code = 'CONFIG_NOT_FOUND';
      throw err;
    }
    if (error instanceof SyntaxError) {
      const err = new Error(`Invalid JSON in configuration file: ${error.message}`);
      err.code = 'CONFIG_PARSE_ERROR';
      throw err;
    }
    throw error;
  }
}

/**
 * Validate configuration against JSON Schema
 * @param {object} config - Configuration object to validate
 * @returns {object} Validation result with valid flag and errors array
 */
function validateConfig(config) {
  const valid = validate(config);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = validate.errors.map(err => ({
    path: err.instancePath,
    message: err.message,
    value: err.data
  }));

  return { valid: false, errors };
}

/**
 * Validate tasks configuration (cron expressions and action types)
 * @param {object} config - Configuration object with tasks array
 * @returns {object} Validation result with valid flag and errors array
 */
function validateTasks(config) {
  const errors = [];

  if (!config.tasks || !Array.isArray(config.tasks)) {
    return { valid: true, errors: [] };
  }

  for (let i = 0; i < config.tasks.length; i++) {
    const task = config.tasks[i];

    // Validate cron expression
    const cronResult = validateCronExpression(task.schedule);
    if (!cronResult.valid) {
      errors.push({
        path: `/tasks/${i}/schedule`,
        message: `Invalid cron expression: ${cronResult.error}`,
        value: task.schedule
      });
    }

    // Validate action types
    if (task.actions && Array.isArray(task.actions)) {
      for (let j = 0; j < task.actions.length; j++) {
        const action = task.actions[j];
        if (!getAction(action.type)) {
          errors.push({
            path: `/tasks/${i}/actions/${j}/type`,
            message: `Unknown action type: ${action.type}`,
            value: action.type
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Load configuration with environment variable support
 * Resolves config path from ATV_CONFIG_PATH or defaults to ./config.json
 * Applies device overrides from ATV_DEVICE_IP and ATV_DEVICE_PORT
 * @param {string} [filePath] - Optional specific config file path to load
 * @returns {object} Loaded and merged configuration object
 */
async function loadConfig(filePath) {
  const configPath = filePath || process.env.ATV_CONFIG_PATH || './config.json';
  logger.debug(`Loading configuration from ${configPath}`);

  const config = await loadConfigFile(configPath);

  if (process.env.ATV_DEVICE_IP) {
    config.device.ip = process.env.ATV_DEVICE_IP;
    logger.debug(`Device IP overridden to ${config.device.ip}`);
  }

  if (process.env.ATV_DEVICE_PORT) {
    config.device.port = parseInt(process.env.ATV_DEVICE_PORT, 10);
    logger.debug(`Device port overridden to ${config.device.port}`);
  }

  logger.debug('Configuration loaded from config.json');
  return config;
}

export { loadConfigFile, validateConfig, validateTasks, loadConfig };
