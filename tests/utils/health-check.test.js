/**
 * Tests for src/health-check.js
 * Health check script for Docker container monitoring
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { healthCheck } from '../../src/health-check.js';

// Create a mock stream that behaves like a Node.js stream
function createMockStream(data = 'health\n') {
  const listeners = {};
  return {
    on: (event, callback) => {
      listeners[event] = callback;
      // Simulate async stream events
      if (event === 'data') {
        setImmediate(() => callback(Buffer.from(data)));
      } else if (event === 'end') {
        setImmediate(() => callback());
      }
      return { on: (e, cb) => { listeners[e] = cb; return this; } };
    },
    destroy: vi.fn()
  };
}

// Mock @devicefarmer/adbkit
vi.mock('@devicefarmer/adbkit', () => ({
  default: {
    Adb: {
      createClient: vi.fn(() => ({
        getDevice: vi.fn((deviceString) => ({
          shell: vi.fn(() => Promise.resolve(createMockStream()))
        }))
      }))
    }
  }
}));

describe('health-check.js', () => {
  let tempConfigPath;
  let consoleLogSpy;
  let processExitSpy;

  beforeEach(async () => {
    // Create a temporary config file for testing
    tempConfigPath = join(tmpdir(), `atv-test-config-${Date.now()}.json`);
    const testConfig = {
      device: {
        ip: '192.168.1.100',
        port: 5555
      },
      tasks: []
    };
    await writeFile(tempConfigPath, JSON.stringify(testConfig));

    // Set environment variable for config path
    process.env.ATV_CONFIG_PATH = tempConfigPath;

    // Spy on console.log and process.exit
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      // Suppress the actual exit, don't throw to avoid unhandled rejection
    });
  });

  afterEach(async () => {
    // Clean up
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    delete process.env.ATV_CONFIG_PATH;
    vi.clearAllMocks();

    // Clean up temp config file
    try {
      await unlink(tempConfigPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('healthy state', () => {
    it('should exit with code 0 when device is reachable', async () => {
      await healthCheck();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should output JSON with healthy status', async () => {
      await healthCheck();

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('healthy');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should include device information in output', async () => {
      await healthCheck();

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.device).toBe('192.168.1.100:5555');
    });
  });

  describe('unhealthy state', () => {
    it('should exit with code 1 when device connection fails', async () => {
      // Mock device.shell to throw error
      const AdbKit = await import('@devicefarmer/adbkit');
      AdbKit.default.Adb.createClient = vi.fn(() => ({
        getDevice: vi.fn(() => ({
          shell: vi.fn(() => Promise.reject(new Error('Connection refused')))
        }))
      }));

      await healthCheck();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON with unhealthy status on error', async () => {
      // Mock device.shell to throw error
      const AdbKit = await import('@devicefarmer/adbkit');
      AdbKit.default.Adb.createClient = vi.fn(() => ({
        getDevice: vi.fn(() => ({
          shell: vi.fn(() => Promise.reject(new Error('Connection refused')))
        }))
      }));

      await healthCheck();

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('unhealthy');
      expect(parsed.error).toBe('Connection refused');
      expect(parsed).toHaveProperty('timestamp');
    });
  });

  describe('timeout handling', () => {
    it('should timeout after 5 seconds when connection hangs', async () => {
      // This test verifies the Promise.race timeout mechanism
      // We mock shell to hang, and verify the timeout Promise wins
      const AdbKit = await import('@devicefarmer/adbkit');
      AdbKit.default.Adb.createClient = vi.fn(() => ({
        getDevice: vi.fn(() => ({
          shell: vi.fn(() => new Promise(() => {})) // Never resolves
        }))
      }));

      const startTime = Date.now();
      await healthCheck();
      const duration = Date.now() - startTime;

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(duration).toBeLessThan(6000); // 5s timeout + 1s grace
    }, 10000); // 10s test timeout
  });
});

