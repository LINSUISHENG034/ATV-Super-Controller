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

describe('Reconnection Integration Tests (Story 1.5)', () => {
  let mockClient;
  let mockDevice;
  let adbClient;
  let AdbKit;
  let loggerModule;

  beforeEach(async () => {
    vi.resetModules();

    AdbKit = (await import('@devicefarmer/adbkit')).default;
    loggerModule = await import('../../src/utils/logger.js');

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

    adbClient = await import('../../src/services/adb-client.js');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1: Heartbeat failure triggers reconnection', () => {
    it('should detect connection loss and log warning within heartbeat interval', async () => {
      vi.useFakeTimers();
      await adbClient.connect('192.168.1.100', 5555);
      mockDevice.shell.mockRejectedValue(new Error('device offline'));

      adbClient.startHealthCheck(5000);
      await vi.advanceTimersByTimeAsync(5000);

      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        'Connection lost, attempting reconnect...',
        expect.objectContaining({ error: 'device offline' })
      );

      adbClient.stopReconnect();
      adbClient.stopHealthCheck();
      vi.useRealTimers();
    });
  });

  describe('AC2: Exponential backoff timing sequence', () => {
    it('should follow exact backoff sequence: 1s, 2s, 4s, 8s, 16s, 30s', async () => {
      vi.useFakeTimers();
      await adbClient.connect('192.168.1.100', 5555);

      const expectedDelays = [0, 1, 2, 4, 8, 16, 30];
      mockClient.connect.mockRejectedValue(new Error('fail'));

      adbClient.reconnect();

      for (let i = 0; i < expectedDelays.length; i++) {
        await vi.advanceTimersByTimeAsync(expectedDelays[i] * 1000);
        expect(loggerModule.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(`attempt ${i + 1}`),
          expect.objectContaining({ delay: expectedDelays[i] })
        );
      }

      adbClient.stopReconnect();
      vi.useRealTimers();
    });
  });

  describe('AC3: Successful reconnection resets backoff', () => {
    it('should reset attempt counter and log success on reconnection', async () => {
      vi.useFakeTimers();
      await adbClient.connect('192.168.1.100', 5555);

      mockClient.connect.mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('192.168.1.100:5555');

      const reconnectPromise = adbClient.reconnect();
      await vi.advanceTimersByTimeAsync(1000); // attempt 1 fails
      await vi.advanceTimersByTimeAsync(2000); // attempt 2 succeeds
      await reconnectPromise;

      expect(loggerModule.logger.info).toHaveBeenCalledWith(
        'Reconnected to device 192.168.1.100:5555'
      );

      const status = adbClient.getConnectionStatus();
      expect(status.reconnecting).toBe(false);
      expect(status.reconnectAttempt).toBe(0);

      adbClient.stopHealthCheck();
      vi.useRealTimers();
    });
  });

  describe('AC4: Persistent retry after max backoff', () => {
    it('should continue retrying at 30s intervals indefinitely', async () => {
      vi.useFakeTimers();
      await adbClient.connect('192.168.1.100', 5555);
      mockClient.connect.mockRejectedValue(new Error('fail'));

      adbClient.reconnect();

      // Advance through entire backoff sequence to reach max
      await vi.advanceTimersByTimeAsync(1000);  // 1s
      await vi.advanceTimersByTimeAsync(2000);  // 2s
      await vi.advanceTimersByTimeAsync(4000);  // 4s
      await vi.advanceTimersByTimeAsync(8000);  // 8s
      await vi.advanceTimersByTimeAsync(16000); // 16s
      await vi.advanceTimersByTimeAsync(30000); // 30s (max)

      // Verify attempt 7 still uses 30s
      await vi.advanceTimersByTimeAsync(30000);
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('attempt 7'),
        expect.objectContaining({ delay: 30 })
      );

      // Verify attempt 8 also uses 30s
      await vi.advanceTimersByTimeAsync(30000);
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('attempt 8'),
        expect.objectContaining({ delay: 30 })
      );

      adbClient.stopReconnect();
      vi.useRealTimers();
    });

    it('should log error with retry count for each failed attempt', async () => {
      vi.useFakeTimers();
      await adbClient.connect('192.168.1.100', 5555);
      mockClient.connect.mockRejectedValue(new Error('ETIMEDOUT'));

      adbClient.reconnect();
      await vi.advanceTimersByTimeAsync(1000);

      expect(loggerModule.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Reconnect failed')
      );

      adbClient.stopReconnect();
      vi.useRealTimers();
    });
  });

  describe('Full integration: health check → reconnect → health check restart', () => {
    it('should complete full reconnection cycle', async () => {
      vi.useFakeTimers();
      await adbClient.connect('192.168.1.100', 5555);

      // Simulate heartbeat failure
      mockDevice.shell.mockRejectedValueOnce(new Error('connection lost'))
        .mockResolvedValue({}); // Subsequent heartbeats succeed

      // Setup reconnection to succeed
      mockClient.connect.mockResolvedValueOnce('192.168.1.100:5555');

      adbClient.startHealthCheck(5000);

      // Trigger heartbeat failure
      await vi.advanceTimersByTimeAsync(5000);
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        'Connection lost, attempting reconnect...',
        expect.any(Object)
      );
      
      // Critical fix verification: Ensure reconnect was actually called by checking for its log
      // With immediate retry (delay 0), this should happen immediately after connection lost
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Reconnection attempt 1'),
        expect.any(Object)
      );

      adbClient.stopHealthCheck();
      vi.useRealTimers();
    });
  });
});
