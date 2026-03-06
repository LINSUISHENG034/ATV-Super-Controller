/**
 * Clear-Cache Action
 * Clears app data/cache via PackageManager.
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger, logAdbCommand } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';
import { shellQuote, isValidPackageName } from '../utils/shell.js';

const clearCacheAction = {
  name: 'clear-cache',
  async execute(device, params) {
    const { package: packageName } = params || {};

    if (!isValidPackageName(packageName)) {
      return errorResult('INVALID_PARAMS', 'Valid package name is required', {
        required: ['package'],
        package: packageName
      });
    }

    try {
      const command = `pm clear ${shellQuote(packageName)}`;
      logAdbCommand(command, device.id);
      const stream = await device.shell(command);
      const output = (await AdbKit.Adb.util.readAll(stream)).toString().trim();

      if (!/success/i.test(output)) {
        logger.error('App cache clear command reported failure', {
          package: packageName,
          output
        });
        return errorResult('CLEAR_CACHE_FAILED', `Failed to clear app cache: ${packageName}`, {
          package: packageName,
          output
        });
      }

      logger.info('App cache cleared successfully', { package: packageName });
      return successResult('App cache cleared successfully', {
        package: packageName,
        output
      });
    } catch (error) {
      logger.error('Failed to clear app cache', { package: packageName, reason: error.message });
      return errorResult('CLEAR_CACHE_FAILED', `Failed to clear app cache: ${packageName}`, {
        package: packageName,
        reason: error.message
      });
    }
  }
};

export { clearCacheAction };
