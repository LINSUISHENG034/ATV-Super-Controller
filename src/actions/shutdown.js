/**
 * Shutdown Action
 * Sends KEYCODE_POWER to turn off device display
 * Checks screen state before/after to handle "already in standby" case
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';

/**
 * Get current screen state from device
 * Error codes: SCREEN_STATE_CHECK_FAILED if shell command fails
 * @param {object} device - ADB device object
 * @returns {Promise<'ON'|'OFF'|'UNKNOWN'>} Screen state
 * @throws {Error} With code property for SCREEN_STATE_CHECK_FAILED
 */
async function getScreenState(device) {
  try {
    const stream = await device.shell("dumpsys power | grep 'Display Power'");
    const outputBuffer = await AdbKit.Adb.util.readAll(stream);
    const output = outputBuffer.toString().trim();

    // Handle Display Power: state=ON/OFF format
    if (output.includes('state=ON')) return 'ON';
    if (output.includes('state=OFF')) return 'OFF';

    // Handle alternative mScreenState=ON/OFF format
    if (output.includes('mScreenState=ON')) return 'ON';
    if (output.includes('mScreenState=OFF')) return 'OFF';

    return 'UNKNOWN';
  } catch (error) {
    // Wrap with specific error code for screen state detection failure
    const screenError = new Error(`Screen state check failed: ${error.message}`);
    screenError.code = 'SCREEN_STATE_CHECK_FAILED';
    throw screenError;
  }
}

/**
 * Shutdown action implementation
 * @type {{name: string, execute: function(object, object): Promise<object>}}
 */
const shutdownAction = {
  name: 'shutdown',
  /**
   * Execute shutdown action
   * @param {object} device - ADB device object with shell() method
   * @param {object} params - Action parameters (unused for shutdown)
   * @returns {Promise<object>} Result object with success/error status
   */
  async execute(device, params) {
    try {
      // Check current screen state
      const currentState = await getScreenState(device);

      // AC2: Device already in standby
      if (currentState === 'OFF') {
        logger.info('Device already in standby');
        return successResult('Device already in standby', { screenState: 'OFF' });
      }

      // AC1: Send power key to toggle off
      await device.shell('input keyevent KEYCODE_POWER');

      // Verify screen turned off
      const newState = await getScreenState(device);

      if (newState === 'OFF') {
        logger.info('Device shutdown successful');
        return successResult('Device shutdown successful', {
          previousState: currentState === 'UNKNOWN' ? 'ON' : currentState,
          currentState: 'OFF'
        });
      }

      // Command sent but verification inconclusive
      logger.info('Shutdown command sent', { note: 'Verification inconclusive' });
      return successResult('Shutdown command sent', {
        previousState: currentState,
        currentState: newState,
        note: 'Verification inconclusive'
      });
    } catch (error) {
      // AC3: Error handling (retry logic handled by executor in Story 3.3)
      const errorCode = error.code || 'SHUTDOWN_FAILED';
      logger.error('Failed to shutdown device', { code: errorCode, reason: error.message });
      return errorResult(errorCode, 'Failed to shutdown device', {
        reason: error.message
      });
    }
  }
};

export { shutdownAction };
