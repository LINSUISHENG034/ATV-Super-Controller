/**
 * Launch-App Action
 * Launches an app on the Android TV using am start command
 * Follows Strategy pattern - receives device object from executor
 */
import { logger } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';

const launchAppAction = {
  name: 'launch-app',
  async execute(device, params) {
    const { package: packageName, activity } = params;

    // Validate required parameters
    if (!packageName) {
      return errorResult('INVALID_PARAMS', 'Package name is required', {
        required: ['package']
      });
    }

    try {
      // Build component string
      // If activity provided, use it; otherwise fallback to .MainActivity
      const activityName = activity || '.MainActivity';
      const component = `${packageName}/${activityName}`;

      // Execute am start command
      // am start -n automatically brings app to foreground if already running (AC3)
      await device.shell(`am start -n ${component}`);

      logger.info('App launched successfully', { package: packageName, activity: activityName });
      return successResult('App launched successfully', {
        package: packageName,
        activity: activityName
      });
    } catch (error) {
      logger.error('Failed to launch app', { package: packageName, reason: error.message });
      return errorResult(
        'LAUNCH_APP_FAILED',
        `Failed to launch app: ${packageName}`,
        { reason: error.message }
      );
    }
  }
};

export { launchAppAction };
