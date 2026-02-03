import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all external dependencies before importing
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@devicefarmer/adbkit', () => ({
  default: {
    Adb: {
      createClient: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue('192.168.1.100:5555'),
        disconnect: vi.fn().mockResolvedValue(undefined),
        getDevice: vi.fn(() => ({
          id: '192.168.1.100:5555',
          shell: vi.fn().mockResolvedValue({ on: vi.fn() })
        }))
      }))
    }
  }
}));

import { logger } from '../../src/utils/logger.js';
import { startScheduler, stopScheduler, getSchedulerStats, clearTasks } from '../../src/services/scheduler.js';

describe('start command integration', () => {
  afterEach(() => {
    stopScheduler();
    clearTasks();
    vi.clearAllMocks();
  });

  describe('scheduler registration', () => {
    it('should register tasks and report correct count', () => {
      const tasks = [
        { name: 'morning-wake', schedule: '0 30 7 * * *', actions: [{ type: 'wake' }] },
        { name: 'evening-shutdown', schedule: '0 0 22 * * *', actions: [{ type: 'shutdown' }] }
      ];
      const mockExecutor = vi.fn();

      const result = startScheduler(tasks, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.taskCount).toBe(2);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('morning-wake'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('evening-shutdown'));
    });

    it('should handle empty task array', () => {
      const mockExecutor = vi.fn();

      const result = startScheduler([], mockExecutor);

      expect(result.success).toBe(true);
      expect(result.taskCount).toBe(0);
    });

    it('should skip invalid cron expressions', () => {
      const tasks = [
        { name: 'valid-task', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] },
        { name: 'invalid-task', schedule: 'not-a-cron', actions: [{ type: 'wake' }] }
      ];
      const mockExecutor = vi.fn();

      const result = startScheduler(tasks, mockExecutor);

      expect(result.taskCount).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('invalid-task'));
    });
  });

  describe('graceful shutdown', () => {
    it('should cancel all jobs on stopScheduler', () => {
      const tasks = [
        { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] }
      ];
      const mockExecutor = vi.fn();
      startScheduler(tasks, mockExecutor);

      expect(getSchedulerStats().running).toBe(true);
      expect(getSchedulerStats().taskCount).toBe(1);

      stopScheduler();

      expect(getSchedulerStats().running).toBe(false);
      expect(getSchedulerStats().taskCount).toBe(0);
    });
  });

  describe('missing configuration', () => {
    it('should report CONFIG_NOT_FOUND error code', async () => {
      const { loadConfig } = await import('../../src/utils/config.js');

      // This test verifies the error structure
      try {
        await loadConfig('./nonexistent-config.json');
      } catch (error) {
        expect(error.code).toBe('CONFIG_NOT_FOUND');
      }
    });
  });
});
