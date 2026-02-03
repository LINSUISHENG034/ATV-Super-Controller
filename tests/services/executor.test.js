import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeTask, retryWithBackoff, getRetryConfig } from '../../src/services/executor.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  },
  logTaskStart: vi.fn(),
  logTaskComplete: vi.fn(),
  logTaskFailed: vi.fn(),
  logWithContext: vi.fn()
}));

vi.mock('../../src/actions/index.js', () => ({
  getAction: vi.fn()
}));

import { getAction } from '../../src/actions/index.js';
import { logger, logTaskComplete } from '../../src/utils/logger.js';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed without retries when function succeeds', async () => {
    const fn = vi.fn().mockResolvedValue({ success: true });

    const promise = retryWithBackoff(fn);
    const { result, retryCount } = await promise;

    expect(result.success).toBe(true);
    expect(retryCount).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry after transient failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ success: true });

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const { result, retryCount } = await promise;

    expect(result.success).toBe(true);
    expect(retryCount).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail after 3 retry attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    const promise = retryWithBackoff(fn);

    // Catch the rejection early to prevent unhandled rejection
    const resultPromise = promise.catch((e) => e);

    // Advance through all retry delays
    await vi.advanceTimersByTimeAsync(1000); // First retry delay
    await vi.advanceTimersByTimeAsync(2000); // Second retry delay

    const error = await resultPromise;
    expect(error.message).toBe('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff delays (1s, 2s, 4s)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce({ success: true });

    const promise = retryWithBackoff(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    await promise;
  });

  it('should log each retry attempt with delay and error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('error1'))
      .mockResolvedValueOnce({ success: true });

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Retry attempt 1/3'),
      expect.objectContaining({ error: 'error1' })
    );
  });

  it('should return correct retryCount after multiple failures then success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce({ success: true });

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const { result, retryCount } = await promise;

    expect(result.success).toBe(true);
    expect(retryCount).toBe(2);
  });
});

describe('getRetryConfig', () => {
  it('should return configured retry values', () => {
    const config = getRetryConfig();

    expect(config.maxRetries).toBe(3);
    expect(config.initialDelay).toBe(1000);
    expect(config.backoffMultiplier).toBe(2);
  });
});

describe('executor service', () => {
  const mockDevice = { id: '192.168.1.100:5555', shell: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeTask', () => {
    it('should execute all actions in sequence', async () => {
      const mockAction = {
        execute: vi.fn().mockResolvedValue({ success: true })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [
          { type: 'wake' },
          { type: 'launch-app', package: 'com.example' }
        ]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.success).toBe(true);
      expect(mockAction.execute).toHaveBeenCalledTimes(2);
      // Verify device is passed correctly to each action
      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, { type: 'wake' }, {});
      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, { type: 'launch-app', package: 'com.example' }, {});
      expect(logTaskComplete).toHaveBeenCalledWith('test-task', expect.any(Number), 'success');
    });

    it('should return error for unknown action type', async () => {
      getAction.mockReturnValue(undefined);

      const task = {
        name: 'test-task',
        actions: [{ type: 'unknown-action' }]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('should stop execution on action failure', async () => {
      const mockAction = {
        execute: vi.fn()
          .mockResolvedValueOnce({ success: true })
          .mockResolvedValueOnce({ success: false, error: 'Action failed' })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [
          { type: 'wake' },
          { type: 'launch-app' },
          { type: 'play-video' }
        ]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.success).toBe(false);
      expect(mockAction.execute).toHaveBeenCalledTimes(2);
    });

    it('should return success for task with no actions', async () => {
      const task = {
        name: 'empty-task',
        actions: []
      };

      const result = await executeTask(task, mockDevice);

      expect(result.success).toBe(true);
    });

    it('should include status and duration in result', async () => {
      const mockAction = {
        execute: vi.fn().mockResolvedValue({ success: true })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [{ type: 'wake' }]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.status).toBe('completed');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.results).toHaveLength(1);
    });

    it('should track action-level results', async () => {
      const mockAction = {
        execute: vi.fn().mockResolvedValue({ success: true })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [
          { type: 'wake' },
          { type: 'launch-app' }
        ]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].action).toBe('wake');
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should include failure details on failed task', async () => {
      const mockAction = {
        execute: vi.fn()
          .mockResolvedValueOnce({ success: true })
          .mockResolvedValueOnce({ success: false, error: 'Connection lost' })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [
          { type: 'wake' },
          { type: 'launch-app' }
        ]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.status).toBe('failed');
      expect(result.failedAtIndex).toBe(1);
      expect(result.failedAction).toBe('launch-app');
      expect(result.error).toBe('Connection lost');
    });

    it('should log task completion with correct message format', async () => {
      const mockAction = {
        execute: vi.fn().mockResolvedValue({ success: true })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'morning-routine',
        actions: [{ type: 'wake' }]
      };

      await executeTask(task, mockDevice);

      expect(logTaskComplete).toHaveBeenCalledWith('morning-routine', expect.any(Number), 'success');
    });

    it('should log warning for task with empty actions array', async () => {
      const task = {
        name: 'empty-task',
        actions: []
      };

      await executeTask(task, mockDevice);

      expect(logger.warn).toHaveBeenCalledWith("Task 'empty-task' has no actions to execute");
    });

    it('should retry when action.execute throws exception', async () => {
      const mockAction = {
        execute: vi.fn()
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({ success: true })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [{ type: 'wake' }]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.success).toBe(true);
      expect(mockAction.execute).toHaveBeenCalledTimes(2);
      expect(result.results[0].retryCount).toBe(1);
    });

    it('should include retryCount in action result when retries occurred', async () => {
      const mockAction = {
        execute: vi.fn()
          .mockRejectedValueOnce(new Error('fail1'))
          .mockRejectedValueOnce(new Error('fail2'))
          .mockResolvedValueOnce({ success: true })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [{ type: 'wake' }]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.success).toBe(true);
      expect(result.results[0].retryCount).toBe(2);
    });

    it('should not include retryCount in action result when no retries occurred', async () => {
      const mockAction = {
        execute: vi.fn().mockResolvedValue({ success: true })
      };
      getAction.mockReturnValue(mockAction);

      const task = {
        name: 'test-task',
        actions: [{ type: 'wake' }]
      };

      const result = await executeTask(task, mockDevice);

      expect(result.results[0].retryCount).toBeUndefined();
    });
  });
});
