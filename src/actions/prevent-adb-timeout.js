/**
 * Prevent ADB Timeout Action
 * Sets adb_allowed_connection_time to 0 to prevent automatic ADB disconnection
 * Command: adb shell settings put global adb_allowed_connection_time 0
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger, logAdbCommand } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';

const preventAdbTimeoutAction = {
  name: 'prevent-adb-timeout',
  async execute(device, params) {
    try {
      // First, check current setting
      const getCommand = 'settings get global adb_allowed_connection_time';
      logAdbCommand(getCommand, device.id);
      const getStream = await device.shell(getCommand);
      const getOutput = await AdbKit.Adb.util.readAll(getStream);
      const currentValue = getOutput.toString().trim();

      logger.debug('Current adb_allowed_connection_time value', { value: currentValue });

      // If already set to 0, return success without modification
      if (currentValue === '0') {
        logger.info('ADB timeout already disabled');
        return successResult('ADB timeout already disabled', {
          status: 'already_disabled',
          currentValue: '0'
        });
      }

      // Set the value to 0 to disable timeout
      const setCommand = 'settings put global adb_allowed_connection_time 0';
      logAdbCommand(setCommand, device.id);
      const setStream = await device.shell(setCommand);
      await AdbKit.Adb.util.readAll(setStream);

      // Verify the change
      const verifyStream = await device.shell(getCommand);
      const verifyOutput = await AdbKit.Adb.util.readAll(verifyStream);
      const newValue = verifyOutput.toString().trim();

      if (newValue === '0') {
        logger.info('ADB timeout disabled successfully', { previousValue: currentValue });
        return successResult('ADB timeout disabled successfully', {
          status: 'disabled',
          previousValue: currentValue,
          newValue: '0'
        });
      } else {
        logger.warn('ADB timeout setting may not have been applied', {
          expected: '0',
          actual: newValue
        });
        return successResult('ADB timeout command sent', {
          status: 'unverified',
          previousValue: currentValue,
          newValue
        });
      }
    } catch (error) {
      logger.error('Failed to disable ADB timeout', { reason: error.message });
      return errorResult('ADB_TIMEOUT_DISABLE_FAILED', 'Failed to disable ADB timeout', {
        reason: error.message
      });
    }
  }
};

export { preventAdbTimeoutAction };
