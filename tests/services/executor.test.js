import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTask } from '../../src/services/executor.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../src/actions/index.js', () => ({
  getAction: vi.fn()
}));

import { getAction } from '../../src/actions/index.js';
import { logger } from '../../src/utils/logger.js';

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
      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, { type: 'wake' });
      expect(mockAction.execute).toHaveBeenCalledWith(mockDevice, { type: 'launch-app', package: 'com.example' });
      expect(logger.info).toHaveBeenCalledWith('Task completed: test-task');
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
  });
});
