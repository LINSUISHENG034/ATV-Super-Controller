/**
 * Action Registry Module
 * Implements Strategy pattern for device actions
 * SOLE registry for all action types
 */
import { launchAppAction } from './launch-app.js';
import { playVideoAction } from './play-video.js';
import { shutdownAction } from './shutdown.js';
import { wakeUpAction } from './wake-up.js';
import { waitAction } from './wait.js';
import { preventAdbTimeoutAction } from './prevent-adb-timeout.js';

const actionRegistry = new Map();

/**
 * Register a new action in the registry
 * @param {object} action - Action object with name and execute function
 * @throws {Error} If action is invalid
 */
function registerAction(action) {
  if (!action.name || typeof action.execute !== 'function') {
    throw new Error('Invalid action: must have name (string) and execute (async function)');
  }
  actionRegistry.set(action.name, action);
}

/**
 * Get an action by name
 * @param {string} name - Action name
 * @returns {object|undefined} Action object or undefined if not found
 */
function getAction(name) {
  return actionRegistry.get(name);
}

/**
 * List all registered action names
 * @returns {string[]} Array of action names
 */
function listActions() {
  return Array.from(actionRegistry.keys());
}

// Register built-in actions
registerAction(wakeUpAction);
registerAction(launchAppAction);
registerAction(playVideoAction);
registerAction(shutdownAction);
registerAction(waitAction);
registerAction(preventAdbTimeoutAction);

export { registerAction, getAction, listActions };
