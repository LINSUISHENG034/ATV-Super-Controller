/**
 * Uninstall-App Action
 * Removes an installed package from the Android device.
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger, logAdbCommand } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';
import { shellQuote, isValidPackageName } from '../utils/shell.js';

const uninstallAppAction = {
  name: 'uninstall-app',
  async execute(device, params) {
    const { package: packageName } = params || {};

    if (!isValidPackageName(packageName)) {
      return errorResult('INVALID_PARAMS', 'Valid package name is required', {
        required: ['package'],
        package: packageName
      });
    }

    try {
      const command = `pm uninstall ${shellQuote(packageName)}`;
      logAdbCommand(command, device.id);
      const stream = await device.shell(command);
      const output = (await AdbKit.Adb.util.readAll(stream)).toString().trim();

      if (!/success/i.test(output)) {
        logger.error('Package uninstall command reported failure', {
          package: packageName,
          output
        });
        return errorResult('UNINSTALL_FAILED', `Failed to uninstall app: ${packageName}`, {
          package: packageName,
          output
        });
      }

      logger.info('App uninstalled successfully', { package: packageName });
      return successResult('App uninstalled successfully', {
        package: packageName,
        output
      });
    } catch (error) {
      logger.error('App uninstall failed', { package: packageName, reason: error.message });
      return errorResult('UNINSTALL_FAILED', `Failed to uninstall app: ${packageName}`, {
        package: packageName,
        reason: error.message
      });
    }
  }
};

export { uninstallAppAction };
