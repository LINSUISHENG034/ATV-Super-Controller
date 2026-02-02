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
let currentIp = null;
let currentPort = null;
let healthCheckInterval = null;
let reconnecting = false;
let reconnectAttempt = 0;
let lastConnectedAt = null;

const BACKOFF_DELAYS = [0, 1000, 2000, 4000, 8000, 16000, 30000];

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
    currentIp = ip;
    currentPort = port;
    connected = true;
    lastConnectedAt = new Date();

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
  currentIp = null;
  currentPort = null;
}

/**
 * Get current connection status
 * @returns {{connected: boolean, device: string|null}}
 */
function getConnectionStatus() {
  return {
    connected,
    reconnecting,
    device: currentDevice ? currentDevice.id : null,
    reconnectAttempt: reconnecting ? reconnectAttempt + 1 : 0,
    lastConnectedAt
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

/**
 * Start health check with periodic heartbeat
 * @param {number} intervalMs - Heartbeat interval in milliseconds (default 5000)
 */
function startHealthCheck(intervalMs = 5000) {
  stopHealthCheck();

  healthCheckInterval = setInterval(async () => {
    if (!currentDevice) return;

    try {
      await currentDevice.shell('echo ping');
    } catch (error) {
      logger.warn('Connection lost, attempting reconnect...', { error: error.message });
      stopHealthCheck();
      reconnect(currentIp, currentPort); // Pass stored connection details
    }
  }, intervalMs);
}

/**
 * Stop the health check interval
 */
function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reconnect to device with exponential backoff
 * @returns {Promise<{success: boolean}>}
 */
async function reconnect() {
  reconnecting = true;
  reconnectAttempt = 0;

  while (reconnecting) {
    const delay = BACKOFF_DELAYS[Math.min(reconnectAttempt, BACKOFF_DELAYS.length - 1)];
    const delaySeconds = delay / 1000;

    logger.warn(`Reconnection attempt ${reconnectAttempt + 1}, waiting ${delaySeconds}s...`, {
      attempt: reconnectAttempt + 1,
      delay: delaySeconds
    });

    await sleep(delay);

    if (!reconnecting) break;

    try {
      const target = `${currentIp}:${currentPort}`;
      await client.connect(target);
      currentDevice = client.getDevice(target);
      connected = true;
      lastConnectedAt = new Date();
      reconnecting = false;
      reconnectAttempt = 0;
      logger.info(`Reconnected to device ${target}`);
      startHealthCheck();
      return { success: true };
    } catch (error) {
      reconnectAttempt++;
      logger.error(`Reconnect failed: ${error.message}`);
    }
  }

  return { success: false };
}

/**
 * Stop ongoing reconnection attempts
 */
function stopReconnect() {
  reconnecting = false;
}

export { connect, disconnect, getConnectionStatus, getDeviceInfo, startHealthCheck, stopHealthCheck, reconnect, stopReconnect };
