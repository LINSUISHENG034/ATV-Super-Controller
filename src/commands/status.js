/**
 * Status command - shows device connection status
 */
import { connect, getConnectionStatus, getDeviceInfo } from '../services/adb-client.js';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Execute status command
 * @returns {Promise<number>} Exit code (0 = connected, 1 = disconnected/error)
 */
export async function statusCommand() {
  try {
    const config = await loadConfig();
    const { ip, port } = config.device;

    const result = await connect(ip, port);

    if (result.connected) {
      const status = getConnectionStatus();
      const deviceInfo = getDeviceInfo();

      if (status.reconnecting) {
        console.log(`Status: Reconnecting`);
        console.log(`Attempt: ${status.reconnectAttempt}`);
      } else {
        console.log(`Status: Connected`);
      }

      console.log(`Device: ${status.device}`);

      if (deviceInfo) {
        console.log(`Device ID: ${deviceInfo.id}`);
      }

      if (status.lastConnectedAt) {
        console.log(`Last Connected: ${status.lastConnectedAt.toISOString()}`);
      }

      return 0;
    } else {
      const status = getConnectionStatus();
      if (status.reconnecting) {
        console.log(`Status: Reconnecting`);
        console.log(`Attempt: ${status.reconnectAttempt}`);
      } else {
        console.log(`Status: Disconnected`);
        console.log(`Error: ${result.error?.message || 'Unknown error'}`);
      }
      return 1;
    }
  } catch (error) {
    logger.error('Status command failed', { error: error.message });
    console.log(`Status: Error`);
    console.log(`Error: ${error.message}`);
    return 1;
  }
}

export { statusCommand as default };
