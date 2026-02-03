import { vi, describe, it, expect, beforeEach } from 'vitest';
import { launchAppAction } from '../../src/actions/launch-app.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  },
  logAdbCommand: vi.fn()
}));

describe('Launch-App Action', () => {
  let mockDevice;

  beforeEach(() => {
    vi.resetAllMocks();

    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn()
    };
  });

  describe('action interface', () => {
    it('should have correct name', () => {
      expect(launchAppAction.name).toBe('launch-app');
    });

    it('should have execute function', () => {
      expect(typeof launchAppAction.execute).toBe('function');
    });
  });

  describe('execute with package and activity (AC1)', () => {
    it('should launch app with package and activity', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await launchAppAction.execute(mockDevice, {
        package: 'com.example.app',
        activity: '.MainActivity'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -n com.example.app/.MainActivity'
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('App launched successfully');
      expect(result.data.package).toBe('com.example.app');
      expect(result.data.activity).toBe('.MainActivity');
    });

    it('should handle activity with full class path', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await launchAppAction.execute(mockDevice, {
        package: 'com.google.android.youtube',
        activity: 'com.google.android.youtube.HomeActivity'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -n com.google.android.youtube/com.google.android.youtube.HomeActivity'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('execute with package only (AC1, Task 2)', () => {
    it('should launch app with package only using MainActivity fallback', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await launchAppAction.execute(mockDevice, {
        package: 'com.example.app'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -n com.example.app/.MainActivity'
      );
      expect(result.success).toBe(true);
      expect(result.data.package).toBe('com.example.app');
      expect(result.data.activity).toBe('.MainActivity');
    });
  });

  describe('error handling (AC2)', () => {
    it('should return error for missing package', async () => {
      const result = await launchAppAction.execute(mockDevice, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PARAMS');
      expect(result.error.message).toBe('Package name is required');
      expect(result.error.details.required).toContain('package');
    });

    it('should return error for empty package', async () => {
      const result = await launchAppAction.execute(mockDevice, {
        package: ''
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PARAMS');
    });

    it('should handle shell command failure', async () => {
      mockDevice.shell.mockRejectedValue(new Error('Package not found'));

      const result = await launchAppAction.execute(mockDevice, {
        package: 'com.invalid.app',
        activity: '.MainActivity'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('LAUNCH_APP_FAILED');
      expect(result.error.message).toContain('Failed to launch app');
      expect(result.error.message).toContain('com.invalid.app');
      expect(result.error.details.reason).toBe('Package not found');
    });

    it('should handle activity not found error', async () => {
      mockDevice.shell.mockRejectedValue(new Error('Activity class {com.example.app/.InvalidActivity} does not exist'));

      const result = await launchAppAction.execute(mockDevice, {
        package: 'com.example.app',
        activity: '.InvalidActivity'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('LAUNCH_APP_FAILED');
    });
  });

  describe('app already running (AC3)', () => {
    it('should bring app to foreground when already running', async () => {
      // am start -n automatically brings app to foreground
      mockDevice.shell.mockResolvedValue({});

      const result = await launchAppAction.execute(mockDevice, {
        package: 'com.example.app',
        activity: '.MainActivity'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -n com.example.app/.MainActivity'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('result structure', () => {
    it('should return proper success result structure', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await launchAppAction.execute(mockDevice, {
        package: 'com.example.app',
        activity: '.MainActivity'
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('package');
      expect(result.data).toHaveProperty('activity');
    });

    it('should return proper error result structure', async () => {
      const result = await launchAppAction.execute(mockDevice, {});

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('details');
    });
  });
});
