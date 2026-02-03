import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerTask,
  getRegisteredTasks,
  getNextRunTimes,
  clearTasks,
  startScheduler,
  stopScheduler,
  getSchedulerStats,
  updateTaskStatus,
  isSchedulerRunning,
  getTaskDetails
} from '../../src/services/scheduler.js';

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
      // node-schedule returns CronDate which has toDate() method
      expect(result.nextRun).toBeDefined();
      expect(typeof result.nextRun.getTime).toBe('function');
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
      // node-schedule returns CronDate which has getTime() method
      expect(typeof times.get('morning-task').getTime).toBe('function');
    });
  });

  describe('startScheduler', () => {
    afterEach(() => {
      stopScheduler();
    });

    it('should register all tasks from array', () => {
      const tasks = [
        { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] },
        { name: 'task2', schedule: '0 0 22 * * *', actions: [{ type: 'shutdown' }] }
      ];
      const mockExecutor = vi.fn();

      const result = startScheduler(tasks, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.taskCount).toBe(2);
      expect(getRegisteredTasks()).toHaveLength(2);
    });

    it('should return task count of 0 for empty array', () => {
      const mockExecutor = vi.fn();

      const result = startScheduler([], mockExecutor);

      expect(result.success).toBe(true);
      expect(result.taskCount).toBe(0);
    });

    it('should skip invalid tasks and continue with valid ones', () => {
      const tasks = [
        { name: 'valid-task', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] },
        { name: 'invalid-task', schedule: 'bad-cron', actions: [{ type: 'wake' }] }
      ];
      const mockExecutor = vi.fn();

      const result = startScheduler(tasks, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.taskCount).toBe(1);
    });
  });

  describe('stopScheduler', () => {
    it('should cancel all scheduled jobs', () => {
      const tasks = [
        { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] }
      ];
      const mockExecutor = vi.fn();
      startScheduler(tasks, mockExecutor);

      stopScheduler();

      expect(getRegisteredTasks()).toHaveLength(0);
    });

    it('should handle being called when no tasks registered', () => {
      expect(() => stopScheduler()).not.toThrow();
    });
  });

  describe('getSchedulerStats', () => {
    afterEach(() => {
      stopScheduler();
    });

    it('should return running false when scheduler not started', () => {
      const stats = getSchedulerStats();

      expect(stats.running).toBe(false);
      expect(stats.taskCount).toBe(0);
    });

    it('should return running true and task count when scheduler started', () => {
      const tasks = [
        { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] },
        { name: 'task2', schedule: '0 0 22 * * *', actions: [{ type: 'shutdown' }] }
      ];
      const mockExecutor = vi.fn();
      startScheduler(tasks, mockExecutor);

      const stats = getSchedulerStats();

      expect(stats.running).toBe(true);
      expect(stats.taskCount).toBe(2);
    });
  });

  describe('isSchedulerRunning', () => {
    afterEach(() => {
      stopScheduler();
    });

    it('should return false when scheduler not started', () => {
      expect(isSchedulerRunning()).toBe(false);
    });

    it('should return true when scheduler is running', () => {
      const tasks = [
        { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] }
      ];
      startScheduler(tasks, vi.fn());

      expect(isSchedulerRunning()).toBe(true);
    });

    it('should return false after scheduler is stopped', () => {
      const tasks = [
        { name: 'task1', schedule: '0 0 7 * * *', actions: [{ type: 'wake' }] }
      ];
      startScheduler(tasks, vi.fn());
      stopScheduler();

      expect(isSchedulerRunning()).toBe(false);
    });
  });

  describe('updateTaskStatus', () => {
    afterEach(() => {
      stopScheduler();
    });

    it('should update lastRunStatus and lastRunTime for existing task', () => {
      registerTask({
        name: 'test-task',
        schedule: '0 0 7 * * *',
        actions: [{ type: 'wake' }]
      });

      updateTaskStatus('test-task', { success: true, status: 'completed' });

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'test-task');
      expect(task.lastRunStatus).toBe('completed');
      expect(task.lastRunTime).toBeInstanceOf(Date);
    });

    it('should store error message on failed execution', () => {
      registerTask({
        name: 'test-task',
        schedule: '0 0 7 * * *',
        actions: [{ type: 'wake' }]
      });

      updateTaskStatus('test-task', {
        success: false,
        status: 'failed',
        error: 'Connection timeout'
      });

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'test-task');
      expect(task.lastRunStatus).toBe('failed');
      expect(task.lastError).toBe('Connection timeout');
    });

    it('should do nothing for non-existent task', () => {
      expect(() => {
        updateTaskStatus('non-existent', { success: true, status: 'completed' });
      }).not.toThrow();
    });
  });

  describe('getTaskDetails', () => {
    afterEach(() => {
      stopScheduler();
    });

    it('should return task details for existing task', () => {
      registerTask({
        name: 'test-task',
        schedule: '0 30 7 * * *',
        actions: [{ type: 'wake' }]
      });

      const details = getTaskDetails('test-task');

      expect(details).toBeDefined();
      expect(details.name).toBe('test-task');
      expect(details.schedule).toBe('0 30 7 * * *');
      expect(details.lastRunStatus).toBeNull();
      expect(details.lastRunTime).toBeNull();
    });

    it('should return null for non-existent task', () => {
      const details = getTaskDetails('non-existent');
      expect(details).toBeNull();
    });
  });

  describe('registerTask with tracking fields', () => {
    it('should initialize lastRunStatus and lastRunTime as null', () => {
      registerTask({
        name: 'new-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'new-task');

      expect(task.lastRunStatus).toBeNull();
      expect(task.lastRunTime).toBeNull();
    });
  });
});
