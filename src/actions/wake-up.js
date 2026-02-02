/**
 * Wake-Up Action
 * Sends KEYCODE_WAKEUP to wake device from standby
 * Uses idempotent KEYCODE_WAKEUP (224) which only wakes, never sleeps
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';

const wakeUpAction = {
  name: 'wake-up',
  async execute(device, params) {
    try {
      // AC3: Check if device is already awake
      const statusStream = await device.shell('dumpsys power | grep mWakefulness=');
      const statusOutput = await AdbKit.Adb.util.readAll(statusStream);
      const statusStr = statusOutput.toString().trim();
      const isAwake = statusStr.includes('mWakefulness=Awake');

      if (isAwake) {
        // AC3: Device already awake - log and return success
        logger.info('Device already awake');
        return successResult('Device already awake', { status: 'already_awake' });
      }

      // AC2: Send KEYCODE_WAKEUP command
      await device.shell('input keyevent KEYCODE_WAKEUP');
      
      logger.info('Device wake-up command sent');
      return successResult('Device wake-up command sent', { keycode: 'KEYCODE_WAKEUP' });
    } catch (error) {
      logger.error('Failed to wake up device', { reason: error.message });
      return errorResult('WAKEUP_FAILED', 'Failed to wake up device', {
        reason: error.message
      });
    }
  }
};

export { wakeUpAction };
