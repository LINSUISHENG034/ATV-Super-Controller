import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock all dependencies before importing the module under test
vi.mock('../../src/actions/index.js');
vi.mock('../../src/utils/config.js');
vi.mock('../../src/utils/logger.js');
vi.mock('../../src/services/adb-client.js');

import { testCommand } from '../../src/commands/test.js';
import { getAction, listActions } from '../../src/actions/index.js';
import { loadConfig } from '../../src/utils/config.js';
import { connect, getDevice, disconnect } from '../../src/services/adb-client.js';
import { logger } from '../../src/utils/logger.js';

describe('Test Command', () => {
  let mockDevice;
  let mockExit;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDevice = { shell: vi.fn() };
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup common mocks
    loadConfig.mockResolvedValue({
      device: { ip: '192.168.0.145', port: 5555 },
      tasks: []
    });
    connect.mockResolvedValue({ connected: true });
    getDevice.mockReturnValue(mockDevice);
    disconnect.mockResolvedValue();
    listActions.mockReturnValue(['wake-up', 'launch-app', 'play-video', 'shutdown']);
    logger.info = vi.fn();
    logger.debug = vi.fn();
    logger.error = vi.fn();
  });

  afterEach(() => {
    mockExit.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('AC1: Direct Action Trigger (wake)', () => {
    it('should execute wake-up action successfully', async () => {
      const mockAction = {
        name: 'wake-up',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Device awakened successfully'
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      expect(getAction).toHaveBeenCalledWith('wake-up');
      expect(connect).toHaveBeenCalledWith('192.168.0.145', 5555);
      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, {}, { youtube: undefined });
      expect(disconnect).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should execute shutdown action successfully', async () => {
      const mockAction = {
        name: 'shutdown',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Device shutdown initiated'
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('shutdown', {})).rejects.toThrow('process.exit called');

      expect(getAction).toHaveBeenCalledWith('shutdown');
      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, {}, { youtube: undefined });
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should display success result in output', async () => {
      const mockAction = {
        name: 'wake-up',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Device awakened successfully'
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('wake-up'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Device awakened successfully'));
    });

    it('should display success result with data details', async () => {
      const mockAction = {
        name: 'wake-up',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Device awakened successfully',
          data: { powerState: 'on', responseTime: 150 }
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      // Verify success message and data details are displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('wake-up'));
      expect(consoleLogSpy).toHaveBeenCalledWith('  Details:', expect.stringContaining('powerState'));
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('AC2: Task Trigger by Name', () => {
    it('should execute action with url parameter for play-video', async () => {
      const mockAction = {
        name: 'play-video',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Video playback started'
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('play-video', { url: 'https://youtube.com/watch?v=test' })).rejects.toThrow('process.exit called');

      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, { url: 'https://youtube.com/watch?v=test' }, { youtube: undefined });
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should execute action with app parameter for launch-app', async () => {
      const mockAction = {
        name: 'launch-app',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'App launched'
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('launch-app', { app: 'com.google.android.youtube.tv' })).rejects.toThrow('process.exit called');

      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, { package: 'com.google.android.youtube.tv' }, { youtube: undefined });
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should execute configured task by name', async () => {
      loadConfig.mockResolvedValue({
        device: { ip: '192.168.0.145', port: 5555 },
        tasks: [{
          name: 'morning-youtube',
          action: { type: 'play-video', url: 'https://youtube.com/watch?v=morning' }
        }]
      });

      // First call returns undefined (not a direct action), second call returns the action
      getAction.mockReturnValueOnce(undefined);
      const mockAction = {
        name: 'play-video',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Video playback started'
        })
      };
      getAction.mockReturnValueOnce(mockAction);

      await expect(testCommand('morning-youtube', {})).rejects.toThrow('process.exit called');

      expect(getAction).toHaveBeenCalledWith('morning-youtube');
      expect(getAction).toHaveBeenCalledWith('play-video');
      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, { type: 'play-video', url: 'https://youtube.com/watch?v=morning' }, { youtube: undefined });
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should log execution details', async () => {
      const mockAction = {
        name: 'wake-up',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Device awakened'
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Executing action'),
        expect.any(Object)
      );
    });
  });

  describe('AC3: Invalid Task/Action Name', () => {
    it('should return error for invalid action name', async () => {
      getAction.mockReturnValue(undefined);
      loadConfig.mockResolvedValue({
        device: { ip: '192.168.0.145', port: 5555 },
        tasks: []
      });

      await expect(testCommand('invalid-action', {})).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Task not found: invalid-action');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should show available actions when task not found', async () => {
      getAction.mockReturnValue(undefined);
      loadConfig.mockResolvedValue({
        device: { ip: '192.168.0.145', port: 5555 },
        tasks: []
      });

      await expect(testCommand('nonexistent', {})).rejects.toThrow('process.exit called');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available actions'));
    });
  });

  describe('Connection Error Handling', () => {
    it('should handle connection failure', async () => {
      const mockAction = {
        name: 'wake-up',
        execute: vi.fn()
      };
      getAction.mockReturnValue(mockAction);
      connect.mockResolvedValue({
        connected: false,
        error: { code: 'CONNECTION_FAILED', message: 'Failed to connect to device' }
      });

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection failed'));
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockAction.execute).not.toHaveBeenCalled();
    });

    it('should handle config load error', async () => {
      const configError = new Error('Configuration file not found: ./config.json');
      configError.code = 'CONFIG_NOT_FOUND';
      loadConfig.mockRejectedValue(configError);

      const mockAction = { name: 'wake-up', execute: vi.fn() };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Exit Codes', () => {
    it('should exit with code 0 on success', async () => {
      const mockAction = {
        name: 'wake-up',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Success'
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should exit with code 1 on action failure', async () => {
      const mockAction = {
        name: 'wake-up',
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'ACTION_FAILED', message: 'Device not responding' }
        })
      };
      getAction.mockReturnValue(mockAction);

      await expect(testCommand('wake-up', {})).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('No Argument Provided', () => {
    it('should show error and available actions when no name provided', async () => {
      await expect(testCommand(undefined, {})).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Action or task name required'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available actions'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
