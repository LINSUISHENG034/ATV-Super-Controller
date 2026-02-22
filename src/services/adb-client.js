/**
 * ADB Client Service Module
 * SOLE OWNER of ADB connection - no other module may access ADB directly
 */
import AdbKit from '@devicefarmer/adbkit';
import { logger, logAdbCommand } from '../utils/logger.js';
import { emitEvent } from '../web/websocket/broadcaster.js';

const Adb = AdbKit.Adb;

let client = null;
let connected = false;
let currentDevice = null;
let currentTarget = null;
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
    currentTarget = target;
    currentIp = ip;
    currentPort = port;
    connected = true;
    reconnecting = false;
    reconnectAttempt = 0;
    lastConnectedAt = new Date();

    logger.info(`Connected to device ${target}`);
    emitEvent('status:device:connected', { target });
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
  stopHealthCheck();
  stopReconnect();

  if (currentTarget && client) {
    try {
      await client.disconnect(currentTarget);
      logger.info(`Disconnected from device ${currentTarget}`);
      emitEvent('status:device:disconnected', { target: currentTarget });
    } catch (error) {
      logger.warn('Error during disconnect', { reason: error.message });
    }
  }
  connected = false;
  currentDevice = null;
  currentTarget = null;
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
    target: currentTarget,
    device: currentTarget,
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
    id: currentTarget
  };
}

/**
 * Get the current device object for action execution
 * @returns {object|null} Device object with shell() method or null if not connected
 */
function getDevice() {
  if (!connected || !currentDevice) {
    return null;
  }
  return currentDevice;
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
      // Task 3.1 & 3.2: Add debug log before each ADB shell command
      logAdbCommand('echo ping', currentTarget);
      const result = await currentDevice.shell('echo ping');
      // Task 3.3: Log command result/response at debug level
      logger.debug('ADB command result', { command: 'echo ping', result });
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
  if (!client || !currentIp || !currentPort) {
    logger.warn('Reconnect requested but no previous connection context exists');
    reconnecting = false;
    reconnectAttempt = 0;
    return { success: false, error: 'NO_CONNECTION_CONTEXT' };
  }

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
      emitEvent('status:device:connected', { target });
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

/**
 * Get device status for API responses
 * Alias for getConnectionStatus to provide consistent naming
 * @returns {{connected: boolean, reconnecting: boolean, target: string|null, lastConnectedAt: Date|null}}
 */
function getDeviceStatus() {
  return getConnectionStatus();
}

/**
 * Capture screen from the connected device
 * @returns {Promise<{success: boolean, image?: string, error?: object}>}
 */
async function captureScreen() {
  if (!connected || !currentDevice) {
    return {
      success: false,
      error: {
        code: 'DEVICE_NOT_CONNECTED',
        message: 'No device connected for screen capture'
      }
    };
  }

  try {
    logAdbCommand('screencap', currentTarget);
    const stream = await currentDevice.screencap();

    // Collect stream data into buffer
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    logger.debug('Screen capture completed', { size: buffer.length });

    return {
      success: true,
      image: dataUrl,
      timestamp: new Date().toISOString(),
      size: buffer.length
    };
  } catch (error) {
    logger.error('Screen capture failed', { reason: error.message });
    return {
      success: false,
      error: {
        code: 'SCREENCAP_FAILED',
        message: 'Failed to capture screen',
        details: { reason: error.message }
      }
    };
  }
}

export { connect, disconnect, getConnectionStatus, getDeviceStatus, getDeviceInfo, getDevice, startHealthCheck, stopHealthCheck, reconnect, stopReconnect, captureScreen };
