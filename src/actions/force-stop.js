/**
 * Force-Stop Action
 * Force stops a package via ActivityManager.
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger, logAdbCommand } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';
import { shellQuote, isValidPackageName } from '../utils/shell.js';

const forceStopAction = {
  name: 'force-stop',
  async execute(device, params) {
    const { package: packageName } = params || {};

    if (!isValidPackageName(packageName)) {
      return errorResult('INVALID_PARAMS', 'Valid package name is required', {
        required: ['package'],
        package: packageName
      });
    }

    try {
      const command = `am force-stop ${shellQuote(packageName)}`;
      logAdbCommand(command, device.id);
      const stream = await device.shell(command);
      await AdbKit.Adb.util.readAll(stream);

      logger.info('App force-stopped successfully', { package: packageName });
      return successResult('App force-stopped successfully', { package: packageName });
    } catch (error) {
      logger.error('Failed to force-stop app', { package: packageName, reason: error.message });
      return errorResult('FORCE_STOP_FAILED', `Failed to stop app: ${packageName}`, {
        package: packageName,
        reason: error.message
      });
    }
  }
};

export { forceStopAction };
