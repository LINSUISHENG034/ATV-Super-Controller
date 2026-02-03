/**
 * Shutdown Action Tests
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdbKit from '@devicefarmer/adbkit';

// Mock AdbKit
vi.mock('@devicefarmer/adbkit', () => ({
  default: {
    Adb: {
      util: {
        readAll: vi.fn()
      }
    }
  }
}));

// Mock logger (L4 fix)
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import after mocks are set up
const { shutdownAction } = await import('../../src/actions/shutdown.js');

describe('Shutdown Action', () => {
  let mockDevice;
  let mockStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn()
    };
    mockStream = { id: 'mock-stream' };
  });

  describe('name property', () => {
    it('should have correct action name', () => {
      expect(shutdownAction.name).toBe('shutdown');
    });
  });

  describe('execute - device awake', () => {
    it('should shutdown device when awake (AC1)', async () => {
      // Setup: device is ON, then power command, then OFF
      mockDevice.shell.mockResolvedValue(mockStream);
      
      let callCount = 0;
      AdbKit.Adb.util.readAll.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(Buffer.from('Display Power: state=ON'));
        }
        return Promise.resolve(Buffer.from('Display Power: state=OFF'));
      });

      const result = await shutdownAction.execute(mockDevice, {});

      expect(mockDevice.shell).toHaveBeenCalledWith('input keyevent KEYCODE_POWER');
      expect(result.success).toBe(true);
      expect(result.message).toContain('shutdown successful');
      expect(result.data.previousState).toBe('ON');
      expect(result.data.currentState).toBe('OFF');
    });
  });

  describe('execute - device already in standby', () => {
    it('should succeed when device already in standby (AC2)', async () => {
      mockDevice.shell.mockResolvedValue(mockStream);
      AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Display Power: state=OFF'));

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Device already in standby');
      expect(result.data.screenState).toBe('OFF');
      // Should NOT send power command when already off
      expect(mockDevice.shell).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute - error handling', () => {
    it('should handle shell command failure (AC3)', async () => {
      mockDevice.shell.mockRejectedValue(new Error('Connection timeout'));

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('SCREEN_STATE_CHECK_FAILED');
      expect(result.error.details.reason).toContain('Connection timeout');
    });

    it('should return SCREEN_STATE_CHECK_FAILED for state detection failure', async () => {
      mockDevice.shell.mockResolvedValue(mockStream);
      AdbKit.Adb.util.readAll.mockRejectedValue(new Error('Read failed'));

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('SCREEN_STATE_CHECK_FAILED');
    });

    it('should return SHUTDOWN_FAILED when power command fails', async () => {
      // First call (dumpsys): succeeds with ON state
      // Second call (power command): fails
      let callCount = 0;
      mockDevice.shell.mockImplementation((cmd) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(mockStream);
        }
        return Promise.reject(new Error('Power command failed'));
      });
      AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Display Power: state=ON'));

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('SHUTDOWN_FAILED');
      expect(result.error.details.reason).toContain('Power command failed');
    });
  });

  describe('screen state detection', () => {
    it('should detect ON state from Display Power output', async () => {
      mockDevice.shell.mockResolvedValue(mockStream);
      
      let callCount = 0;
      AdbKit.Adb.util.readAll.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(Buffer.from('Display Power: state=ON'));
        }
        return Promise.resolve(Buffer.from('Display Power: state=OFF'));
      });

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result.success).toBe(true);
    });

    it('should handle alternative mScreenState format', async () => {
      mockDevice.shell.mockResolvedValue(mockStream);
      
      let callCount = 0;
      AdbKit.Adb.util.readAll.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(Buffer.from('mScreenState=ON'));
        }
        return Promise.resolve(Buffer.from('mScreenState=OFF'));
      });

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result.success).toBe(true);
    });

    it('should handle UNKNOWN screen state gracefully', async () => {
      mockDevice.shell.mockResolvedValue(mockStream);
      
      let callCount = 0;
      AdbKit.Adb.util.readAll.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(Buffer.from('some unexpected output'));
        }
        return Promise.resolve(Buffer.from('Display Power: state=OFF'));
      });

      const result = await shutdownAction.execute(mockDevice, {});

      // Should still attempt shutdown when state is unknown
      expect(mockDevice.shell).toHaveBeenCalledWith('input keyevent KEYCODE_POWER');
      expect(result.success).toBe(true);
    });
  });

  describe('Result object structure', () => {
    it('should return correct success result structure', async () => {
      mockDevice.shell.mockResolvedValue(mockStream);
      AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Display Power: state=OFF'));

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
    });

    it('should return correct error result structure', async () => {
      mockDevice.shell.mockRejectedValue(new Error('Test error'));

      const result = await shutdownAction.execute(mockDevice, {});

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('details');
    });
  });
});
