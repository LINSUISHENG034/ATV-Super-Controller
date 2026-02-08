/**
 * Config Persistence Service
 * Handles saving configuration changes to config.json with atomic writes
 */
import { readFile, writeFile, rename, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';

// Default config path
const DEFAULT_CONFIG_PATH = process.env.ATV_CONFIG_PATH || './config/config.json';

/**
 * Load current configuration from file
 * @param {string} [configPath] - Path to config file
 * @returns {Promise<object>} Configuration object
 */
async function loadCurrentConfig(configPath = DEFAULT_CONFIG_PATH) {
  const content = await readFile(configPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Save configuration to file with atomic write
 * Creates a backup before overwriting
 * @param {object} config - Configuration object to save
 * @param {string} [configPath] - Path to config file
 * @returns {Promise<void>}
 */
async function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  const backupPath = `${configPath}.backup`;
  const tempPath = `${configPath}.tmp`;

  try {
    // Create backup of existing config
    if (existsSync(configPath)) {
      await writeFile(backupPath, await readFile(configPath, 'utf8'), 'utf8');
    }

    // Write to temp file first (atomic write pattern)
    const content = JSON.stringify(config, null, 2);
    await writeFile(tempPath, content, 'utf8');

    // Rename temp to actual config (atomic on most filesystems)
    await rename(tempPath, configPath);

    logger.info('Configuration saved successfully');
  } catch (error) {
    // Clean up temp file if it exists
    if (existsSync(tempPath)) {
      await unlink(tempPath).catch(() => {});
    }
    logger.error(`Failed to save configuration: ${error.message}`);
    throw error;
  }
}

/**
 * Add a new task to configuration
 * @param {object} task - Task object with name, schedule, actions
 * @param {string} [configPath] - Path to config file
 * @returns {Promise<object>} The added task
 */
async function addTask(task, configPath = DEFAULT_CONFIG_PATH) {
  const config = await loadCurrentConfig(configPath);

  // Check for duplicate task name
  const existingTask = config.tasks.find(t => t.name === task.name);
  if (existingTask) {
    const error = new Error(`Task with name '${task.name}' already exists`);
    error.code = 'TASK_EXISTS';
    throw error;
  }

  // Add task to config
  config.tasks.push(task);

  // Save updated config
  await saveConfig(config, configPath);

  logger.info(`Task added: ${task.name}`);
  return task;
}

/**
 * Update an existing task in configuration
 * @param {string} taskName - Name of task to update
 * @param {object} updatedTask - Updated task object
 * @param {string} [configPath] - Path to config file
 * @returns {Promise<object>} The updated task
 */
async function updateTask(taskName, updatedTask, configPath = DEFAULT_CONFIG_PATH) {
  const config = await loadCurrentConfig(configPath);

  // Find task index
  const taskIndex = config.tasks.findIndex(t => t.name === taskName);
  if (taskIndex === -1) {
    const error = new Error(`Task '${taskName}' not found`);
    error.code = 'TASK_NOT_FOUND';
    throw error;
  }

  // Check for name collision if renaming
  if (updatedTask.name !== taskName) {
    const nameCollision = config.tasks.find(t => t.name === updatedTask.name);
    if (nameCollision) {
      const error = new Error(`Task with name '${updatedTask.name}' already exists`);
      error.code = 'TASK_EXISTS';
      throw error;
    }
  }

  // Update task
  config.tasks[taskIndex] = updatedTask;

  // Save updated config
  await saveConfig(config, configPath);

  logger.info(`Task updated: ${taskName}`);
  return updatedTask;
}

/**
 * Delete a task from configuration
 * @param {string} taskName - Name of task to delete
 * @param {string} [configPath] - Path to config file
 * @returns {Promise<void>}
 */
async function deleteTask(taskName, configPath = DEFAULT_CONFIG_PATH) {
  const config = await loadCurrentConfig(configPath);

  // Find task index
  const taskIndex = config.tasks.findIndex(t => t.name === taskName);
  if (taskIndex === -1) {
    const error = new Error(`Task '${taskName}' not found`);
    error.code = 'TASK_NOT_FOUND';
    throw error;
  }

  // Remove task
  config.tasks.splice(taskIndex, 1);

  // Save updated config
  await saveConfig(config, configPath);

  logger.info(`Task deleted: ${taskName}`);
}

/**
 * Get a task by name from configuration
 * @param {string} taskName - Name of task to get
 * @param {string} [configPath] - Path to config file
 * @returns {Promise<object|null>} Task object or null if not found
 */
async function getTask(taskName, configPath = DEFAULT_CONFIG_PATH) {
  const config = await loadCurrentConfig(configPath);
  return config.tasks.find(t => t.name === taskName) || null;
}

export {
  loadCurrentConfig,
  saveConfig,
  addTask,
  updateTask,
  deleteTask,
  getTask
};
