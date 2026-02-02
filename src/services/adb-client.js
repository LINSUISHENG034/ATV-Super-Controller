/**
 * ADB Client Service Module
 * SOLE OWNER of ADB connection - no other module may access ADB directly
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger } from '../utils/logger.js';

const Adb = AdbKit.Adb;

let client = null;
let connected = false;
let currentDevice = null;

/**
 * Connect to Android TV device via ADB over TCP
 * @param {string} ip - Device IP address
 * @param {number} port - ADB port (default 5555)
 * @returns {Promise<{connected: boolean, device?: object, error?: object}>}
 */
async function connect(ip, port = 5555) {
  try {
    if (!client) {
      client = Adb.createClient();
    }

    const target = `${ip}:${port}`;
    await client.connect(target);

    currentDevice = client.getDevice(target);
    connected = true;

    logger.info(`Connected to device ${target}`);
    return { connected: true, device: currentDevice };
  } catch (error) {
    connected = false;
    currentDevice = null;
    const errorInfo = {
      code: 'CONNECTION_FAILED',
      message: `Failed to connect to ${ip}:${port}`,
      details: { ip, port, reason: error.message }
    };
    logger.error(errorInfo.message, errorInfo.details);
    return { connected: false, error: errorInfo };
  }
}

/**
 * Disconnect from the current device
 */
async function disconnect() {
  if (currentDevice && client) {
    try {
      const target = currentDevice.id;
      await client.disconnect(target);
      logger.info(`Disconnected from device ${target}`);
    } catch (error) {
      logger.warn('Error during disconnect', { reason: error.message });
    }
  }
  connected = false;
  currentDevice = null;
}

/**
 * Get current connection status
 * @returns {{connected: boolean, device: string|null}}
 */
function getConnectionStatus() {
  return {
    connected,
    device: currentDevice ? currentDevice.id : null
  };
}

/**
 * Get device info when connected
 * @returns {object|null} Device info or null if not connected
 */
function getDeviceInfo() {
  if (!connected || !currentDevice) {
    return null;
  }
  return {
    id: currentDevice.id
  };
}

export { connect, disconnect, getConnectionStatus, getDeviceInfo };
