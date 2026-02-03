import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitAction } from '../../src/actions/wait.js';

describe('wait action', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    it('should wait for specified duration', async () => {
      const device = {}; // unused but required by interface
      const params = { duration: 5000 };

      const promise = waitAction.execute(device, params);
      vi.advanceTimersByTime(5000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.message).toContain('5000');
    });

    it('should return success for zero duration', async () => {
      const device = {};
      const params = { duration: 0 };

      const promise = waitAction.execute(device, params);
      vi.advanceTimersByTime(0);
      const result = await promise;

      expect(result.success).toBe(true);
    });

    it('should fail for negative duration', async () => {
      const device = {};
      const params = { duration: -1000 };

      const result = await waitAction.execute(device, params);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_DURATION');
    });

    it('should fail for missing duration', async () => {
      const device = {};
      const params = {};

      const result = await waitAction.execute(device, params);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_DURATION');
    });

    it('should fail for non-number duration', async () => {
      const device = {};
      const params = { duration: 'not a number' };

      const result = await waitAction.execute(device, params);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_DURATION');
    });
  });

  describe('action interface', () => {
    it('should have correct name', () => {
      expect(waitAction.name).toBe('wait');
    });

    it('should have execute function', () => {
      expect(typeof waitAction.execute).toBe('function');
    });
  });
});
