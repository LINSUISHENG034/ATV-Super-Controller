/**
 * Action Registry Tests
 * Tests for the Strategy pattern action registry
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerAction, getAction, listActions } from '../../src/actions/index.js';

describe('Action Registry', () => {
  describe('registerAction', () => {
    it('should register a valid action', () => {
      const testAction = {
        name: 'test-action',
        execute: async () => ({ success: true })
      };

      expect(() => registerAction(testAction)).not.toThrow();
    });

    it('should throw error for action without name', () => {
      const invalidAction = {
        execute: async () => ({ success: true })
      };

      expect(() => registerAction(invalidAction)).toThrow('Invalid action');
    });

    it('should throw error for action without execute function', () => {
      const invalidAction = {
        name: 'no-execute'
      };

      expect(() => registerAction(invalidAction)).toThrow('Invalid action');
    });

    it('should throw error for action with non-function execute', () => {
      const invalidAction = {
        name: 'bad-execute',
        execute: 'not a function'
      };

      expect(() => registerAction(invalidAction)).toThrow('Invalid action');
    });
  });

  describe('getAction', () => {
    it('should retrieve a registered action by name', () => {
      const testAction = {
        name: 'retrievable-action',
        execute: async () => ({ success: true })
      };
      registerAction(testAction);

      const retrieved = getAction('retrievable-action');

      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('retrievable-action');
    });

    it('should return undefined for unknown action', () => {
      const result = getAction('non-existent-action');

      expect(result).toBeUndefined();
    });
  });

  describe('listActions', () => {
    it('should return array of registered action names', () => {
      const actions = listActions();

      expect(Array.isArray(actions)).toBe(true);
    });

    it('should include registered action names', () => {
      const testAction = {
        name: 'listed-action',
        execute: async () => ({ success: true })
      };
      registerAction(testAction);

      const actions = listActions();

      expect(actions).toContain('listed-action');
    });
  });
});
