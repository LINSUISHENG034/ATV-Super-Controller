/**
 * Wake-Up Action
 * Sends KEYCODE_WAKEUP to wake device from standby
 * Uses idempotent KEYCODE_WAKEUP (224) which only wakes, never sleeps
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger, logAdbCommand } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';

const wakeUpAction = {
  name: 'wake',
  async execute(device, params) {
    try {
      // AC3: Check if device is already awake
      const statusCommand = 'dumpsys power | grep mWakefulness=';
      logAdbCommand(statusCommand, device.id);
      const statusStream = await device.shell(statusCommand);
      const statusOutput = await AdbKit.Adb.util.readAll(statusStream);
      const statusStr = statusOutput.toString().trim();
      const isAwake = statusStr.includes('mWakefulness=Awake');

      if (isAwake) {
        // AC3: Device already awake - log and return success
        logger.info('Device already awake');
        return successResult('Device already awake', { status: 'already_awake' });
      }

      // AC2: Send KEYCODE_POWER command (more universally compatible than KEYCODE_WAKEUP)
      const wakeCommand = 'input keyevent KEYCODE_POWER';
      logAdbCommand(wakeCommand, device.id);
      await device.shell(wakeCommand);
      
      // Wait a moment for the device to wake
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify wake succeeded
      const verifyCommand = 'dumpsys power | grep mWakefulness=';
      logAdbCommand(verifyCommand, device.id);
      const verifyStream = await device.shell(verifyCommand);
      const verifyOutput = await AdbKit.Adb.util.readAll(verifyStream);
      const verifyStr = verifyOutput.toString().trim();
      const wakeSucceeded = verifyStr.includes('mWakefulness=Awake');
      
      if (wakeSucceeded) {
        logger.info('Device woken up successfully');
        return successResult('Device woken up successfully', { 
          keycode: 'KEYCODE_POWER',
          verified: true 
        });
      } else {
        logger.warn('Wake command sent but device may not have woken', { state: verifyStr });
        return successResult('Device wake-up command sent', { 
          keycode: 'KEYCODE_POWER',
          verified: false,
          state: verifyStr
        });
      }
    } catch (error) {
      logger.error('Failed to wake up device', { reason: error.message });
      return errorResult('WAKEUP_FAILED', 'Failed to wake up device', {
        reason: error.message
      });
    }
  }
};

export { wakeUpAction };
