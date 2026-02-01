/**
 * Spike Configuration
 *
 * IMPORTANT: Update these values before running tests!
 */

export const CONFIG = {
  // Your Android TV device IP address
  DEVICE_IP: '192.168.0.145',

  // ADB TCP port (default is 5555)
  DEVICE_PORT: 5555,

  // YouTube video URL for testing
  TEST_VIDEO_URL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',

  // Timeout for operations (ms)
  TIMEOUT: 10000
};

export function getDeviceAddress() {
  return `${CONFIG.DEVICE_IP}:${CONFIG.DEVICE_PORT}`;
}
