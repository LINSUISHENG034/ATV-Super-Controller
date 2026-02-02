/**
 * Action Result Helper Tests
 */
import { describe, it, expect } from 'vitest';
import { successResult, errorResult } from '../../src/actions/result.js';

describe('Action Result Helpers', () => {
  describe('successResult', () => {
    it('should create success result with message only', () => {
      const result = successResult('Operation completed');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Operation completed');
      expect(result.data).toBeUndefined();
    });

    it('should create success result with message and data', () => {
      const result = successResult('Device woke up', { keycode: 'KEYCODE_WAKEUP' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Device woke up');
      expect(result.data).toEqual({ keycode: 'KEYCODE_WAKEUP' });
    });
  });

  describe('errorResult', () => {
    it('should create error result with code and message', () => {
      const result = errorResult('WAKEUP_FAILED', 'Failed to wake device');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('WAKEUP_FAILED');
      expect(result.error.message).toBe('Failed to wake device');
      expect(result.error.details).toBeUndefined();
    });

    it('should create error result with details', () => {
      const result = errorResult('CONNECTION_LOST', 'Connection failed', { reason: 'timeout' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CONNECTION_LOST');
      expect(result.error.message).toBe('Connection failed');
      expect(result.error.details).toEqual({ reason: 'timeout' });
    });
  });
});
