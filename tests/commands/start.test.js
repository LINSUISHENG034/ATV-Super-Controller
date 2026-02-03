import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startCommand } from '../../src/commands/start.js';

// Mock dependencies
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn()
}));

vi.mock('../../src/services/adb-client.js', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getDevice: vi.fn()
}));

vi.mock('../../src/services/scheduler.js', () => ({
  startScheduler: vi.fn(),
  stopScheduler: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { loadConfig } from '../../src/utils/config.js';
import { connect, disconnect, getDevice } from '../../src/services/adb-client.js';
import { startScheduler, stopScheduler } from '../../src/services/scheduler.js';
import { logger } from '../../src/utils/logger.js';

describe('start command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful startup', () => {
    it('should load config, connect to device, and start scheduler', async () => {
      const mockConfig = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: [
          { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] }
        ]
      };
      const mockDevice = { id: '192.168.1.100:5555' };

      loadConfig.mockResolvedValue(mockConfig);
      connect.mockResolvedValue({ connected: true, device: mockDevice });
      getDevice.mockReturnValue(mockDevice);
      startScheduler.mockReturnValue({ success: true, taskCount: 1 });

      await startCommand();

      expect(loadConfig).toHaveBeenCalled();
      expect(connect).toHaveBeenCalledWith('192.168.1.100', 5555);
      expect(startScheduler).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Scheduler started with 1 tasks'));
    });

    it('should log task count correctly for multiple tasks', async () => {
      const mockConfig = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: [
          { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] },
          { name: 'task2', schedule: '0 0 22 * * *', actions: [{ type: 'shutdown' }] }
        ]
      };

      loadConfig.mockResolvedValue(mockConfig);
      connect.mockResolvedValue({ connected: true });
      getDevice.mockReturnValue({ id: '192.168.1.100:5555' });
      startScheduler.mockReturnValue({ success: true, taskCount: 2 });

      await startCommand();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Scheduler started with 2 tasks'));
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration file', async () => {
      const configError = new Error('Configuration file not found');
      configError.code = 'CONFIG_NOT_FOUND';
      loadConfig.mockRejectedValue(configError);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await startCommand();

      expect(logger.error).toHaveBeenCalledWith('Configuration file not found');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle device connection failure', async () => {
      const mockConfig = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: []
      };

      loadConfig.mockResolvedValue(mockConfig);
      connect.mockResolvedValue({ connected: false, error: { message: 'Connection refused' } });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

      await startCommand();

      expect(logger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('signal handlers', () => {
    it('should register SIGINT and SIGTERM handlers on successful startup', async () => {
      const mockConfig = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: []
      };

      loadConfig.mockResolvedValue(mockConfig);
      connect.mockResolvedValue({ connected: true });
      getDevice.mockReturnValue({ id: '192.168.1.100:5555' });
      startScheduler.mockReturnValue({ success: true, taskCount: 0 });

      const onSpy = vi.spyOn(process, 'on');

      await startCommand();

      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      onSpy.mockRestore();
    });
  });
});
