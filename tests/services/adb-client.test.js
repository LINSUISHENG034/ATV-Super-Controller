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
  },
  logAdbCommand: vi.fn()
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

  describe('getDevice()', () => {
    it('should return null when not connected', () => {
      const device = adbClient.getDevice();
      expect(device).toBeNull();
    });

    it('should return device object when connected', async () => {
      await adbClient.connect('192.168.1.100', 5555);

      const device = adbClient.getDevice();

      expect(device).toBeDefined();
      expect(device.id).toBe('192.168.1.100:5555');
    });

    it('should return device with shell method', async () => {
      await adbClient.connect('192.168.1.100', 5555);

      const device = adbClient.getDevice();

      expect(typeof device.shell).toBe('function');
    });
  });

  describe('Health Check - AC1 (Story 1.5)', () => {
    describe('startHealthCheck()', () => {
      it('should start periodic heartbeat checks', async () => {
        vi.useFakeTimers();
        await adbClient.connect('192.168.1.100', 5555);
        mockDevice.shell.mockResolvedValue({});

        adbClient.startHealthCheck(5000);

        // Advance timer to trigger first heartbeat
        await vi.advanceTimersByTimeAsync(5000);

        expect(mockDevice.shell).toHaveBeenCalledWith('echo ping');
        vi.useRealTimers();
      });

      it('should use default 5s interval when not specified', async () => {
        vi.useFakeTimers();
        await adbClient.connect('192.168.1.100', 5555);
        mockDevice.shell.mockResolvedValue({});

        adbClient.startHealthCheck();

        // Should not call before 5s
        await vi.advanceTimersByTimeAsync(4999);
        expect(mockDevice.shell).not.toHaveBeenCalled();

        // Should call at 5s
        await vi.advanceTimersByTimeAsync(1);
        expect(mockDevice.shell).toHaveBeenCalledWith('echo ping');
        vi.useRealTimers();
      });

      it('should detect disconnection when heartbeat fails', async () => {
        vi.useFakeTimers();
        const { logger } = await import('../../src/utils/logger.js');
        await adbClient.connect('192.168.1.100', 5555);
        mockDevice.shell.mockRejectedValue(new Error('Connection lost'));

        adbClient.startHealthCheck(5000);
        await vi.advanceTimersByTimeAsync(5000);

        expect(logger.warn).toHaveBeenCalledWith(
          'Connection lost, attempting reconnect...',
          expect.objectContaining({ error: 'Connection lost' })
        );
        vi.useRealTimers();
      });
    });

    describe('stopHealthCheck()', () => {
      it('should stop the health check interval', async () => {
        vi.useFakeTimers();
        await adbClient.connect('192.168.1.100', 5555);
        mockDevice.shell.mockResolvedValue({});

        adbClient.startHealthCheck(5000);
        adbClient.stopHealthCheck();

        await vi.advanceTimersByTimeAsync(10000);

        expect(mockDevice.shell).not.toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should handle being called when no health check is running', () => {
        expect(() => adbClient.stopHealthCheck()).not.toThrow();
      });
    });
  });

  describe('Exponential Backoff Reconnection - AC2, AC3, AC4 (Story 1.5)', () => {
    describe('reconnect()', () => {
      it('should use exponential backoff delays: 1s, 2s, 4s, 8s, 16s, 30s', async () => {
        vi.useFakeTimers();
        const { logger } = await import('../../src/utils/logger.js');

        // First connect, then simulate disconnect
        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockRejectedValueOnce(new Error('Connection refused'))
          .mockRejectedValueOnce(new Error('Connection refused'))
          .mockRejectedValueOnce(new Error('Connection refused'))
          .mockResolvedValueOnce('192.168.1.100:5555');

        const reconnectPromise = adbClient.reconnect();

        // 0s delay - attempt 1 (immediate)
        // No advance needed for 0s, but we need to let the promise loop run
        await vi.advanceTimersByTimeAsync(0); 
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('attempt 1'),
          expect.objectContaining({ delay: 0 })
        );

        // 1s delay - attempt 2
        await vi.advanceTimersByTimeAsync(1000);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('attempt 2'),
          expect.objectContaining({ delay: 1 })
        );

        // 2s delay - attempt 3
        await vi.advanceTimersByTimeAsync(2000);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('attempt 3'),
          expect.objectContaining({ delay: 2 })
        );

        // 4s delay - attempt 4 (success)
        await vi.advanceTimersByTimeAsync(4000);
        await reconnectPromise;

        vi.useRealTimers();
      });

      it('should log reconnection success message (AC3)', async () => {
        vi.useFakeTimers();
        const { logger } = await import('../../src/utils/logger.js');

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockResolvedValueOnce('192.168.1.100:5555');

        const reconnectPromise = adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(1000);
        await reconnectPromise;

        expect(logger.info).toHaveBeenCalledWith('Reconnected to device 192.168.1.100:5555');
        vi.useRealTimers();
      });

      it('should reset backoff after successful reconnection (AC3)', async () => {
        vi.useFakeTimers();

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockResolvedValueOnce('192.168.1.100:5555');

        const reconnectPromise = adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(1000);
        const result = await reconnectPromise;

        expect(result.success).toBe(true);
        vi.useRealTimers();
      });

      it('should continue retrying at 30s max interval (AC4)', async () => {
        vi.useFakeTimers();
        const { logger } = await import('../../src/utils/logger.js');

        await adbClient.connect('192.168.1.100', 5555);
        // Fail many times to reach max backoff
        mockClient.connect.mockRejectedValue(new Error('Connection refused'));

        const reconnectPromise = adbClient.reconnect();

        // Advance through backoff sequence: 0+1+2+4+8+16+30 = 61s
        await vi.advanceTimersByTimeAsync(0);     // attempt 1
        await vi.advanceTimersByTimeAsync(1000);  // attempt 2
        await vi.advanceTimersByTimeAsync(2000);  // attempt 3
        await vi.advanceTimersByTimeAsync(4000);  // attempt 4
        await vi.advanceTimersByTimeAsync(8000);  // attempt 5
        await vi.advanceTimersByTimeAsync(16000); // attempt 6 (max)
        await vi.advanceTimersByTimeAsync(30000); // attempt 7 (stays at max)

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('attempt 7'),
          expect.objectContaining({ delay: 30 })
        );

        // Stop reconnection for cleanup
        adbClient.stopReconnect();
        vi.useRealTimers();
      });

      it('should log each retry attempt with delay (AC2)', async () => {
        vi.useFakeTimers();
        const { logger } = await import('../../src/utils/logger.js');

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValueOnce('192.168.1.100:5555');

        const reconnectPromise = adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(2000);
        await reconnectPromise;

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Reconnection attempt'),
          expect.objectContaining({ attempt: 1, delay: 0 })
        );
        vi.useRealTimers();
      });
    });

    describe('stopReconnect()', () => {
      it('should stop ongoing reconnection attempts', async () => {
        vi.useFakeTimers();

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockRejectedValue(new Error('fail'));

        adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(1000);

        adbClient.stopReconnect();
        const callCount = mockClient.connect.mock.calls.length;

        await vi.advanceTimersByTimeAsync(10000);
        expect(mockClient.connect.mock.calls.length).toBe(callCount);

        vi.useRealTimers();
      });
    });
  });

  describe('Connection State Management - AC1, AC3 (Story 1.5)', () => {
    describe('getConnectionStatus() extended', () => {
      it('should return reconnecting state when reconnecting', async () => {
        vi.useFakeTimers();

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockRejectedValue(new Error('fail'));

        adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(500);

        const status = adbClient.getConnectionStatus();
        expect(status.reconnecting).toBe(true);

        adbClient.stopReconnect();
        vi.useRealTimers();
      });

      it('should return reconnectAttempt count during reconnection', async () => {
        vi.useFakeTimers();

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockRejectedValue(new Error('fail'));

        adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(1000); // attempt 1
        await vi.advanceTimersByTimeAsync(2000); // attempt 2

        const status = adbClient.getConnectionStatus();
        expect(status.reconnectAttempt).toBeGreaterThan(0);

        adbClient.stopReconnect();
        vi.useRealTimers();
      });

      it('should return lastConnectedAt timestamp', async () => {
        await adbClient.connect('192.168.1.100', 5555);

        const status = adbClient.getConnectionStatus();
        expect(status.lastConnectedAt).toBeDefined();
        expect(status.lastConnectedAt).toBeInstanceOf(Date);
      });

      it('should reset reconnecting state after successful reconnection', async () => {
        vi.useFakeTimers();

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockResolvedValueOnce('192.168.1.100:5555');

        const reconnectPromise = adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(1000);
        await reconnectPromise;

        const status = adbClient.getConnectionStatus();
        expect(status.reconnecting).toBe(false);
        expect(status.reconnectAttempt).toBe(0);

        vi.useRealTimers();
      });
    });

    describe('Health check integration', () => {
      it('should trigger reconnect when heartbeat fails', async () => {
        vi.useFakeTimers();
        const { logger } = await import('../../src/utils/logger.js');

        await adbClient.connect('192.168.1.100', 5555);
        mockDevice.shell.mockRejectedValue(new Error('Connection lost'));

        adbClient.startHealthCheck(5000);
        await vi.advanceTimersByTimeAsync(5000);

        expect(logger.warn).toHaveBeenCalledWith(
          'Connection lost, attempting reconnect...',
          expect.any(Object)
        );

        adbClient.stopReconnect();
        vi.useRealTimers();
      });

      it('should restart health check after successful reconnection', async () => {
        vi.useFakeTimers();

        await adbClient.connect('192.168.1.100', 5555);
        mockClient.connect.mockResolvedValueOnce('192.168.1.100:5555');
        mockDevice.shell.mockResolvedValue({});

        const reconnectPromise = adbClient.reconnect();
        await vi.advanceTimersByTimeAsync(1000);
        await reconnectPromise;

        // Health check should be restarted - advance to trigger it
        await vi.advanceTimersByTimeAsync(5000);
        expect(mockDevice.shell).toHaveBeenCalledWith('echo ping');

        adbClient.stopHealthCheck();
        vi.useRealTimers();
      });
    });
  });
});
