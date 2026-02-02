import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @devicefarmer/adbkit before importing the module
vi.mock('@devicefarmer/adbkit', () => ({
  default: {
    Adb: {
      createClient: vi.fn()
    }
  }
}));

// Mock logger to suppress output during tests
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ADB Client Service', () => {
  let mockClient;
  let mockDevice;
  let adbClient;
  let AdbKit;

  beforeEach(async () => {
    // Reset modules to get fresh state
    vi.resetModules();

    // Re-import mocked module
    AdbKit = (await import('@devicefarmer/adbkit')).default;

    mockDevice = {
      id: '192.168.1.100:5555',
      shell: vi.fn()
    };

    mockClient = {
      connect: vi.fn().mockResolvedValue('192.168.1.100:5555'),
      getDevice: vi.fn().mockReturnValue(mockDevice),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    AdbKit.Adb.createClient.mockReturnValue(mockClient);

    // Import fresh module instance
    adbClient = await import('../../src/services/adb-client.js');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect(ip, port) - AC1', () => {
    it('should establish ADB TCP connection successfully', async () => {
      const result = await adbClient.connect('192.168.1.100', 5555);

      expect(result.connected).toBe(true);
      expect(mockClient.connect).toHaveBeenCalledWith('192.168.1.100:5555');
    });

    it('should use default port 5555 when not specified', async () => {
      await adbClient.connect('192.168.1.100');

      expect(mockClient.connect).toHaveBeenCalledWith('192.168.1.100:5555');
    });

    it('should return device reference on successful connection', async () => {
      const result = await adbClient.connect('192.168.1.100', 5555);

      expect(result.device).toBeDefined();
      expect(mockClient.getDevice).toHaveBeenCalledWith('192.168.1.100:5555');
    });
  });

  describe('connect() error handling - AC2', () => {
    it('should return error object when connection fails', async () => {
      mockClient.connect.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await adbClient.connect('192.168.1.100', 5555);

      expect(result.connected).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('CONNECTION_FAILED');
    });

    it('should include IP and port in error details', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection refused'));

      const result = await adbClient.connect('10.0.0.1', 5556);

      expect(result.error.details.ip).toBe('10.0.0.1');
      expect(result.error.details.port).toBe(5556);
    });

    it('should include reason in error details', async () => {
      mockClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await adbClient.connect('192.168.1.100', 5555);

      expect(result.error.details.reason).toBe('ECONNREFUSED');
    });

    it('should set error message with IP and port', async () => {
      mockClient.connect.mockRejectedValue(new Error('timeout'));

      const result = await adbClient.connect('192.168.1.100', 5555);

      expect(result.error.message).toBe('Failed to connect to 192.168.1.100:5555');
    });
  });

  describe('disconnect()', () => {
    it('should disconnect from device', async () => {
      await adbClient.connect('192.168.1.100', 5555);
      await adbClient.disconnect();

      const status = adbClient.getConnectionStatus();
      expect(status.connected).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      // Should not throw
      await expect(adbClient.disconnect()).resolves.not.toThrow();
    });
  });

  describe('getConnectionStatus()', () => {
    it('should return disconnected status initially', () => {
      const status = adbClient.getConnectionStatus();

      expect(status.connected).toBe(false);
      expect(status.device).toBeNull();
    });

    it('should return connected status after successful connection', async () => {
      await adbClient.connect('192.168.1.100', 5555);

      const status = adbClient.getConnectionStatus();

      expect(status.connected).toBe(true);
      expect(status.device).toBe('192.168.1.100:5555');
    });

    it('should return disconnected status after failed connection', async () => {
      mockClient.connect.mockRejectedValue(new Error('failed'));

      await adbClient.connect('192.168.1.100', 5555);

      const status = adbClient.getConnectionStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe('getDeviceInfo()', () => {
    it('should return null when not connected', () => {
      const info = adbClient.getDeviceInfo();
      expect(info).toBeNull();
    });

    it('should return device info when connected', async () => {
      await adbClient.connect('192.168.1.100', 5555);

      const info = adbClient.getDeviceInfo();

      expect(info).toBeDefined();
      expect(info.id).toBe('192.168.1.100:5555');
    });
  });
});
