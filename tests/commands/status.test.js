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

// Mock scheduler module
vi.mock('../../src/services/scheduler.js', () => ({
  isSchedulerRunning: vi.fn(),
  getRegisteredTasks: vi.fn()
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
  let scheduler;
  let consoleSpy;

  beforeEach(async () => {
    vi.resetModules();

    adbClient = await import('../../src/services/adb-client.js');
    config = await import('../../src/utils/config.js');
    scheduler = await import('../../src/services/scheduler.js');

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Default scheduler mocks
    scheduler.isSchedulerRunning.mockReturnValue(false);
    scheduler.getRegisteredTasks.mockReturnValue([]);

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
    scheduler.isSchedulerRunning.mockReturnValue(true);

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

  describe('Scheduler Service Status - Story 3.4 AC1, AC2', () => {
    it('should show "Service: Running" when scheduler is running', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555'
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: '192.168.1.100:5555' });
      scheduler.isSchedulerRunning.mockReturnValue(true);
      scheduler.getRegisteredTasks.mockReturnValue([]);

      await statusCommand();

      expect(consoleSpy).toHaveBeenCalledWith('Service: Running');
    });

    it('should show "Service: Not running" when scheduler is not running', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555'
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: '192.168.1.100:5555' });
      scheduler.isSchedulerRunning.mockReturnValue(false);

      await statusCommand();

      expect(consoleSpy).toHaveBeenCalledWith('Service: Not running');
    });

    it('should return exit code 1 when service is not running', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555'
      });
      scheduler.isSchedulerRunning.mockReturnValue(false);

      const exitCode = await statusCommand();

      expect(exitCode).toBe(1);
    });

    it('should return exit code 0 when service is running', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555'
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: '192.168.1.100:5555' });
      scheduler.isSchedulerRunning.mockReturnValue(true);
      scheduler.getRegisteredTasks.mockReturnValue([]);

      const exitCode = await statusCommand();

      expect(exitCode).toBe(0);
    });
  });

  describe('JSON Output - Story 3.4 AC3', () => {
    it('should output valid JSON when --json flag is passed', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555',
        lastConnectedAt: new Date('2026-02-03T10:00:00.000Z')
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
      scheduler.isSchedulerRunning.mockReturnValue(true);
      scheduler.getRegisteredTasks.mockReturnValue([]);

      await statusCommand({ json: true });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include service status in JSON output', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555'
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
      scheduler.isSchedulerRunning.mockReturnValue(true);
      scheduler.getRegisteredTasks.mockReturnValue([]);

      await statusCommand({ json: true });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.service.status).toBe('running');
    });

    it('should include tasks array in JSON output', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555'
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
      scheduler.isSchedulerRunning.mockReturnValue(true);
      const mockDate = new Date('2026-02-04T07:30:00.000Z');
      scheduler.getRegisteredTasks.mockReturnValue([
        {
          name: 'morning-wake',
          schedule: '0 30 7 * * *',
          nextRun: mockDate,
          lastRunStatus: 'completed',
          lastRunTime: new Date('2026-02-03T07:30:00.000Z')
        }
      ]);

      await statusCommand({ json: true });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.tasks).toHaveLength(1);
      expect(output.tasks[0].name).toBe('morning-wake');
      expect(output.tasks[0].schedule).toBe('0 30 7 * * *');
    });
  });

  describe('Task List Display - Story 3.4 AC3', () => {
    it('should display task name, schedule, next run, and last status', async () => {
      config.loadConfig.mockResolvedValue({
        device: { ip: '192.168.1.100', port: 5555 }
      });
      adbClient.connect.mockResolvedValue({ connected: true });
      adbClient.getConnectionStatus.mockReturnValue({
        connected: true,
        device: '192.168.1.100:5555'
      });
      adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
      scheduler.isSchedulerRunning.mockReturnValue(true);
      scheduler.getRegisteredTasks.mockReturnValue([
        {
          name: 'morning-wake',
          schedule: '0 30 7 * * *',
          nextRun: new Date('2026-02-04T07:30:00.000Z'),
          lastRunStatus: 'completed',
          lastRunTime: new Date('2026-02-03T07:30:00.000Z')
        }
      ]);

      await statusCommand();

      // Verify task name is displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('morning-wake'));
      // Verify schedule is displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0 30 7 * * *'));
      // Verify next run is displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Next Run'));
      // Verify last status is displayed
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('completed'));
    });
  });

  // Story 4.1 Tests - Task Execution Status Tracking
  describe('Story 4.1 - Task Execution Status Tracking', () => {
    describe('Failure Count Display - AC3', () => {
      it('should display failure count in human output', async () => {
        config.loadConfig.mockResolvedValue({
          device: { ip: '192.168.1.100', port: 5555 }
        });
        adbClient.connect.mockResolvedValue({ connected: true });
        adbClient.getConnectionStatus.mockReturnValue({
          connected: true,
          device: '192.168.1.100:5555'
        });
        adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
        scheduler.isSchedulerRunning.mockReturnValue(true);
        scheduler.getRegisteredTasks.mockReturnValue([
          {
            name: 'test-task',
            schedule: '0 30 7 * * *',
            nextRun: new Date('2026-02-04T07:30:00.000Z'),
            lastRunStatus: 'failed',
            lastRunTime: new Date('2026-02-03T07:30:00.000Z'),
            failureCount: 3,
            executionHistory: []
          }
        ]);

        await statusCommand();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failures: 3'));
      });

      it('should include failureCount in JSON output', async () => {
        config.loadConfig.mockResolvedValue({
          device: { ip: '192.168.1.100', port: 5555 }
        });
        adbClient.connect.mockResolvedValue({ connected: true });
        adbClient.getConnectionStatus.mockReturnValue({
          connected: true,
          device: '192.168.1.100:5555'
        });
        adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
        scheduler.isSchedulerRunning.mockReturnValue(true);
        scheduler.getRegisteredTasks.mockReturnValue([
          {
            name: 'test-task',
            schedule: '0 30 7 * * *',
            nextRun: new Date('2026-02-04T07:30:00.000Z'),
            lastRunStatus: 'failed',
            lastRunTime: new Date('2026-02-03T07:30:00.000Z'),
            failureCount: 5,
            executionHistory: []
          }
        ]);

        await statusCommand({ json: true });

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.tasks[0].failureCount).toBe(5);
      });
    });

    describe('Execution History Display - AC2', () => {
      it('should display last 3 executions in human output', async () => {
        config.loadConfig.mockResolvedValue({
          device: { ip: '192.168.1.100', port: 5555 }
        });
        adbClient.connect.mockResolvedValue({ connected: true });
        adbClient.getConnectionStatus.mockReturnValue({
          connected: true,
          device: '192.168.1.100:5555'
        });
        adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
        scheduler.isSchedulerRunning.mockReturnValue(true);

        const mockHistory = [
          { status: 'completed', endTime: new Date('2026-02-04T07:30:00.000Z'), duration: 1500 },
          { status: 'completed', endTime: new Date('2026-02-03T07:30:00.000Z'), duration: 1200 },
          { status: 'failed', endTime: new Date('2026-02-02T07:30:00.000Z'), duration: 500, error: 'Timeout' }
        ];

        scheduler.getRegisteredTasks.mockReturnValue([
          {
            name: 'history-task',
            schedule: '0 30 7 * * *',
            nextRun: new Date('2026-02-05T07:30:00.000Z'),
            lastRunStatus: 'completed',
            lastRunTime: new Date('2026-02-04T07:30:00.000Z'),
            failureCount: 1,
            executionHistory: mockHistory
          }
        ]);

        await statusCommand();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recent Executions'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✓ completed'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✗ failed'));
      });

      it('should display error message for failed executions', async () => {
        config.loadConfig.mockResolvedValue({
          device: { ip: '192.168.1.100', port: 5555 }
        });
        adbClient.connect.mockResolvedValue({ connected: true });
        adbClient.getConnectionStatus.mockReturnValue({
          connected: true,
          device: '192.168.1.100:5555'
        });
        adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
        scheduler.isSchedulerRunning.mockReturnValue(true);
        scheduler.getRegisteredTasks.mockReturnValue([
          {
            name: 'error-task',
            schedule: '0 30 7 * * *',
            nextRun: new Date('2026-02-05T07:30:00.000Z'),
            lastRunStatus: 'failed',
            lastRunTime: new Date('2026-02-04T07:30:00.000Z'),
            failureCount: 2,
            executionHistory: [
              { status: 'failed', endTime: new Date('2026-02-04T07:30:00.000Z'), duration: 300, error: 'Connection failed' }
            ]
          }
        ]);

        await statusCommand();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Connection failed'));
      });

      it('should include full executionHistory array in JSON output', async () => {
        config.loadConfig.mockResolvedValue({
          device: { ip: '192.168.1.100', port: 5555 }
        });
        adbClient.connect.mockResolvedValue({ connected: true });
        adbClient.getConnectionStatus.mockReturnValue({
          connected: true,
          device: '192.168.1.100:5555'
        });
        adbClient.getDeviceInfo.mockReturnValue({ id: 'abc123' });
        scheduler.isSchedulerRunning.mockReturnValue(true);

        const mockHistory = [
          { status: 'completed', startTime: new Date('2026-02-04T07:29:58.500Z'), endTime: new Date('2026-02-04T07:30:00.000Z'), duration: 1500 },
          { status: 'failed', startTime: new Date('2026-02-03T07:29:59.500Z'), endTime: new Date('2026-02-03T07:30:00.000Z'), duration: 500, error: 'Timeout' }
        ];

        scheduler.getRegisteredTasks.mockReturnValue([
          {
            name: 'full-history-task',
            schedule: '0 30 7 * * *',
            nextRun: new Date('2026-02-05T07:30:00.000Z'),
            lastRunStatus: 'completed',
            lastRunTime: new Date('2026-02-04T07:30:00.000Z'),
            failureCount: 1,
            executionHistory: mockHistory
          }
        ]);

        await statusCommand({ json: true });

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.tasks[0].executionHistory).toHaveLength(2);
        expect(output.tasks[0].executionHistory[0].status).toBe('completed');
        expect(output.tasks[0].executionHistory[1].status).toBe('failed');
        expect(output.tasks[0].executionHistory[1].error).toBe('Timeout');
      });
    });
  });
});
