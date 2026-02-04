#!/usr/bin/env node
/**
 * Health check script for Docker container monitoring
 *
 * This standalone script verifies ADB device connectivity for Docker health checks.
 * Exit code 0 = healthy (device reachable), Exit code 1 = unhealthy
 *
 * Usage: node src/health-check.js
 * Environment: ATV_CONFIG_PATH (optional, defaults to /app/config/config.json)
 */

import AdbKit from '@devicefarmer/adbkit';
const Adb = AdbKit.Adb;
import { loadConfig } from './utils/config.js';

// Health check timeout in milliseconds (5 seconds max)
const HEALTH_CHECK_TIMEOUT = 5000;

/**
 * Consume and close a stream properly to prevent resource leaks
 * @param {Stream} stream - The stream to consume
 * @returns {Promise<Buffer>} - The stream content
 */
async function consumeStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Main health check function
 * Attempts to connect to the configured ADB device and execute a simple shell command
 */
async function healthCheck() {
  let stream = null;
  try {
    // Load configuration (respects ATV_CONFIG_PATH environment variable)
    const config = await loadConfig();

    // Create ADB client
    const client = Adb.createClient();
    const deviceString = `${config.device.ip}:${config.device.port}`;

    // Get device reference
    const device = client.getDevice(deviceString);

    // Quick shell test with timeout protection
    // Promise.race ensures we don't hang indefinitely
    stream = await Promise.race([
      device.shell('echo health'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
      ),
    ]);

    // Properly consume and close the stream to prevent resource leaks
    await consumeStream(stream);

    // Health check passed - output JSON and exit cleanly
    console.log(JSON.stringify({
      status: 'healthy',
      device: deviceString,
      timestamp: new Date().toISOString()
    }));
    process.exit(0);
    return; // Explicit return for test compatibility

  } catch (error) {
    // Clean up stream if it exists
    if (stream && typeof stream.destroy === 'function') {
      stream.destroy();
    }

    // Health check failed - output error details and exit with error code
    console.log(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    process.exit(1);
    return; // Explicit return for test compatibility
  }
}

// Execute health check
healthCheck();

// Export for testing
export { healthCheck };
