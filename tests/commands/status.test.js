import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock adb-client module
vi.mock('../../src/services/adb-client.js', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getConnectionStatus: vi.fn(),
  getDeviceInfo: vi.fn(),
  startHealthCheck: vi.fn(),
  stopHealthCheck: vi.fn(),
  reconnect: vi.fn(),
  stopReconnect: vi.fn()
}));

// Mock config module
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn()
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Status Command - AC3', () => {
  let statusCommand;
  let adbClient;
  let config;
  let consoleSpy;

  beforeEach(async () => {
    vi.resetModules();

    adbClient = await import('../../src/services/adb-client.js');
    config = await import('../../src/utils/config.js');

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const statusModule = await import('../../src/commands/status.js');
    statusCommand = statusModule.statusCommand;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should show "Connected" when device is connected', async () => {
    config.loadConfig.mockResolvedValue({
      device: { ip: '192.168.1.100', port: 5555 }
    });
    adbClient.connect.mockResolvedValue({ connected: true });
    adbClient.getConnectionStatus.mockReturnValue({
      connected: true,
      device: '192.168.1.100:5555'
    });
    adbClient.getDeviceInfo.mockReturnValue({ id: '192.168.1.100:5555' });

    const exitCode = await statusCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Connected')
    );
    expect(exitCode).toBe(0);
  });

  it('should show device info when connected', async () => {
    config.loadConfig.mockResolvedValue({
      device: { ip: '192.168.1.100', port: 5555 }
    });
    adbClient.connect.mockResolvedValue({ connected: true });
    adbClient.getConnectionStatus.mockReturnValue({
      connected: true,
      device: '192.168.1.100:5555'
    });
    adbClient.getDeviceInfo.mockReturnValue({ id: '192.168.1.100:5555' });

    await statusCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('192.168.1.100:5555')
    );
  });

  it('should return exit code 1 when disconnected', async () => {
    config.loadConfig.mockResolvedValue({
      device: { ip: '192.168.1.100', port: 5555 }
    });
    adbClient.connect.mockResolvedValue({
      connected: false,
      error: { code: 'CONNECTION_FAILED', message: 'Failed' }
    });
    adbClient.getConnectionStatus.mockReturnValue({
      connected: false,
      device: null
    });

    const exitCode = await statusCommand();

    expect(exitCode).toBe(1);
  });

  it('should return exit code 1 on config error', async () => {
    config.loadConfig.mockRejectedValue(new Error('Config not found'));

    const exitCode = await statusCommand();

    expect(exitCode).toBe(1);
  });

  describe('Reconnecting State Display - Story 1.5 AC1, AC2', () => {
    it('should show "Reconnecting" when in reconnecting state', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: false,
        reconnecting: true,
        device: null,
        reconnectAttempt: 3,
        lastConnectedAt: new Date('2026-02-02T10:00:00')
      });

      await statusCommand();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting')
      );
    });

    it('should show reconnection attempt count', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: false,
        reconnecting: true,
        device: null,
        reconnectAttempt: 5,
        lastConnectedAt: new Date()
      });

      await statusCommand();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('5')
      );
    });

    it('should show last connected time', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        reconnecting: false,
        device: '192.168.1.100:5555',
        reconnectAttempt: 0,
        lastConnectedAt: new Date('2026-02-02T10:30:00')
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: '192.168.1.100:5555' });

      await statusCommand();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Last Connected')
      );
    });
  });
});
