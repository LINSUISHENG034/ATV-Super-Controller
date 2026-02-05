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
  getTaskDetails,
  recordExecution,
  setTaskEnabled
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

    it('should include failureCount and executionHistory in task details', () => {
      registerTask({
        name: 'details-task',
        schedule: '0 30 7 * * *',
        actions: [{ type: 'wake' }]
      });

      // Record some executions
      const startTime = Date.now() - 1000;
      const endTime = Date.now();
      recordExecution('details-task', {
        success: false,
        status: 'failed',
        error: 'Test error',
        duration: 1000
      }, startTime, endTime);

      const details = getTaskDetails('details-task');

      expect(details).toBeDefined();
      expect(details.failureCount).toBe(1);
      expect(details.executionHistory).toHaveLength(1);
      expect(details.executionHistory[0].status).toBe('failed');
      expect(details.executionHistory[0].error).toBe('Test error');
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

  // Story 4.1 Tests - Task Execution Status Tracking
  describe('recordExecution - Story 4.1', () => {
    it('should initialize failureCount and executionHistory for new task', () => {
      registerTask({
        name: 'history-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'history-task');

      expect(task.failureCount).toBe(0);
      expect(task.executionHistory).toEqual([]);
    });

    it('should record successful execution with timing data', () => {
      registerTask({
        name: 'success-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      const startTime = Date.now() - 1000;
      const endTime = Date.now();

      recordExecution('success-task', {
        success: true,
        status: 'completed',
        duration: 1000
      }, startTime, endTime);

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'success-task');

      expect(task.executionHistory).toHaveLength(1);
      expect(task.executionHistory[0].status).toBe('completed');
      expect(task.executionHistory[0].startTime).toEqual(new Date(startTime));
      expect(task.executionHistory[0].endTime).toEqual(new Date(endTime));
      expect(task.executionHistory[0].duration).toBe(1000);
      expect(task.failureCount).toBe(0);
    });

    it('should record failed execution with error and increment failureCount', () => {
      registerTask({
        name: 'fail-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      const startTime = Date.now() - 500;
      const endTime = Date.now();

      recordExecution('fail-task', {
        success: false,
        status: 'failed',
        error: 'Connection timeout',
        duration: 500
      }, startTime, endTime);

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'fail-task');

      expect(task.executionHistory).toHaveLength(1);
      expect(task.executionHistory[0].status).toBe('failed');
      expect(task.executionHistory[0].error).toBe('Connection timeout');
      expect(task.failureCount).toBe(1);
    });

    it('should maintain circular buffer - drop oldest when history exceeds MAX_HISTORY_ENTRIES', () => {
      registerTask({
        name: 'buffer-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      // Record 12 executions (MAX_HISTORY_ENTRIES is 10, so 2 should be dropped)
      for (let i = 0; i < 12; i++) {
        const startTime = Date.now() - (i * 1000);
        const endTime = Date.now() - (i * 1000) + 100;
        recordExecution('buffer-task', {
          success: true,
          status: 'completed',
          duration: 100
        }, startTime, endTime);
      }

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'buffer-task');

      expect(task.executionHistory).toHaveLength(10);
    });

    it('should increment failureCount only on failures, not on success', () => {
      registerTask({
        name: 'mixed-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      const startTime = Date.now() - 100;
      const endTime = Date.now();

      // Record 3 successes and 2 failures
      for (let i = 0; i < 3; i++) {
        recordExecution('mixed-task', {
          success: true,
          status: 'completed',
          duration: 100
        }, startTime, endTime);
      }
      for (let i = 0; i < 2; i++) {
        recordExecution('mixed-task', {
          success: false,
          status: 'failed',
          error: 'Error',
          duration: 50
        }, startTime, endTime);
      }

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'mixed-task');

      expect(task.executionHistory).toHaveLength(5);
      expect(task.failureCount).toBe(2);
    });

    it('should update lastRunStatus and lastRunTime via updateTaskStatus (backward compatibility)', () => {
      registerTask({
        name: 'compat-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      const startTime = Date.now() - 100;
      const endTime = Date.now();

      recordExecution('compat-task', {
        success: true,
        status: 'completed',
        duration: 100
      }, startTime, endTime);

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'compat-task');

      expect(task.lastRunStatus).toBe('completed');
      expect(task.lastRunTime).toBeInstanceOf(Date);
    });

    it('should handle recording for non-existent task gracefully', () => {
      expect(() => {
        recordExecution('non-existent', {
          success: true,
          status: 'completed',
          duration: 100
        }, Date.now() - 100, Date.now());
      }).not.toThrow();
    });

    it('should handle invalid result object gracefully', () => {
      registerTask({
        name: 'validation-task',
        schedule: '0 0 8 * * *',
        actions: [{ type: 'wake' }]
      });

      // Should not throw with null result
      expect(() => {
        recordExecution('validation-task', null, Date.now() - 100, Date.now());
      }).not.toThrow();

      // Should not throw with missing status
      expect(() => {
        recordExecution('validation-task', { success: true }, Date.now() - 100, Date.now());
      }).not.toThrow();

      // Task should remain unchanged
      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'validation-task');
      expect(task.executionHistory).toHaveLength(0);
    });
  });

  // Story 6.3 Tests - Task Management (setTaskEnabled)
  describe('setTaskEnabled - Story 6.3', () => {
    beforeEach(() => {
      // Start scheduler with a test task
      startScheduler([
        {
          name: 'test-task',
          schedule: '0 0 8 * * *',
          actions: [{ type: 'wake' }]
        }
      ], vi.fn());
    });

    afterEach(() => {
      stopScheduler();
    });

    it('should disable a task by cancelling its job', () => {
      const result = setTaskEnabled('test-task', false);

      expect(result.name).toBe('test-task');
      expect(result.enabled).toBe(false);

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'test-task');
      expect(task.job).toBeNull();
      expect(task.nextRun).toBeNull();
    });

    it('should enable a task by creating a new job', () => {
      // First disable the task
      setTaskEnabled('test-task', false);

      // Then enable it
      const result = setTaskEnabled('test-task', true);

      expect(result.name).toBe('test-task');
      expect(result.enabled).toBe(true);

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'test-task');
      expect(task.job).not.toBeNull();
      expect(task.nextRun).not.toBeNull();
    });

    it('should throw TASK_NOT_FOUND for non-existent task', () => {
      expect(() => {
        setTaskEnabled('non-existent-task', true);
      }).toThrow('TASK_NOT_FOUND');
    });

    it('should handle enabling an already enabled task', () => {
      const result1 = setTaskEnabled('test-task', true);
      expect(result1.enabled).toBe(true);

      const tasks = getRegisteredTasks();
      const task1 = tasks.find(t => t.name === 'test-task');
      const originalNextRun = task1.nextRun;

      // Enable again - should reschedule
      const result2 = setTaskEnabled('test-task', true);
      expect(result2.enabled).toBe(true);

      const task2 = tasks.find(t => t.name === 'test-task');
      expect(task2.job).not.toBeNull();
      expect(task2.nextRun).not.toBeNull();
    });

    it('should handle disabling an already disabled task', () => {
      // Disable the task
      setTaskEnabled('test-task', false);

      // Disable again - should be idempotent
      const result = setTaskEnabled('test-task', false);
      expect(result.enabled).toBe(false);

      const tasks = getRegisteredTasks();
      const task = tasks.find(t => t.name === 'test-task');
      expect(task.job).toBeNull();
      expect(task.nextRun).toBeNull();
    });
  });
});
