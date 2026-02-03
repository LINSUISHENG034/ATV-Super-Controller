import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerTask, getRegisteredTasks, getNextRunTimes, clearTasks } from '../../src/services/scheduler.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('scheduler service', () => {
  beforeEach(() => {
    clearTasks();
  });

  afterEach(() => {
    clearTasks();
  });

  describe('registerTask', () => {
    it('should register a valid task', () => {
      const task = {
        name: 'test-task',
        schedule: '0 30 7 * * *',
        actions: [{ type: 'wake' }]
      };

      const result = registerTask(task);

      expect(result.success).toBe(true);
      expect(result.nextRun).toBeInstanceOf(Date);
    });

    it('should reject task with invalid cron expression', () => {
      const task = {
        name: 'bad-task',
        schedule: 'invalid',
        actions: [{ type: 'wake' }]
      };

      const result = registerTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject task without name', () => {
      const task = {
        schedule: '0 0 0 * * *',
        actions: [{ type: 'wake' }]
      };

      const result = registerTask(task);

      expect(result.success).toBe(false);
    });
  });

  describe('getRegisteredTasks', () => {
    it('should return empty array when no tasks registered', () => {
      const tasks = getRegisteredTasks();
      expect(tasks).toEqual([]);
    });

    it('should return registered tasks', () => {
      registerTask({
        name: 'task1',
        schedule: '0 0 0 * * *',
        actions: [{ type: 'wake' }]
      });
      registerTask({
        name: 'task2',
        schedule: '0 30 12 * * *',
        actions: [{ type: 'shutdown' }]
      });

      const tasks = getRegisteredTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.name)).toContain('task1');
      expect(tasks.map(t => t.name)).toContain('task2');
    });
  });

  describe('getNextRunTimes', () => {
    it('should return empty map when no tasks registered', () => {
      const times = getNextRunTimes();
      expect(times.size).toBe(0);
    });

    it('should return next run times for registered tasks', () => {
      registerTask({
        name: 'morning-task',
        schedule: '0 30 7 * * *',
        actions: [{ type: 'wake' }]
      });

      const times = getNextRunTimes();

      expect(times.has('morning-task')).toBe(true);
      expect(times.get('morning-task')).toBeInstanceOf(Date);
    });
  });
});
