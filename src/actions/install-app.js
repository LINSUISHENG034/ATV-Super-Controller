/**
 * Install-App Action
 * Installs an APK already present on the Android device.
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger, logAdbCommand } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';
import { shellQuote } from '../utils/shell.js';

const installAppAction = {
  name: 'install-app',
  async execute(device, params) {
    const { apkPath, package: packageName } = params || {};

    if (!apkPath || typeof apkPath !== 'string') {
      return errorResult('INVALID_PARAMS', 'APK path is required', {
        required: ['apkPath']
      });
    }

    try {
      const command = `pm install -r ${shellQuote(apkPath)}`;
      logAdbCommand(command, device.id);
      const stream = await device.shell(command);
      const output = (await AdbKit.Adb.util.readAll(stream)).toString().trim();

      if (!/success/i.test(output)) {
        logger.error('APK install command reported failure', { apkPath, output });
        return errorResult('INSTALL_FAILED', 'APK installation failed', { output, apkPath });
      }

      logger.info('APK installed successfully', { apkPath, package: packageName || null });
      return successResult('APK installed successfully', {
        apkPath,
        package: packageName || null,
        output
      });
    } catch (error) {
      logger.error('APK install failed', { apkPath, reason: error.message });
      return errorResult('INSTALL_FAILED', 'APK installation failed', {
        reason: error.message,
        apkPath
      });
    }
  }
};

export { installAppAction };
