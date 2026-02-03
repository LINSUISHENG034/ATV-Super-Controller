import { describe, it, expect } from 'vitest';
import { validateCronExpression, getNextRunTime } from '../../src/utils/cron-validator.js';

describe('cron-validator', () => {
  describe('validateCronExpression', () => {
    describe('valid 6-field cron expressions', () => {
      it('should validate standard 6-field cron expression', () => {
        const result = validateCronExpression('0 30 7 * * *');
        expect(result.valid).toBe(true);
        expect(result.nextRun).toBeInstanceOf(Date);
      });

      it('should validate every-second expression', () => {
        const result = validateCronExpression('* * * * * *');
        expect(result.valid).toBe(true);
        expect(result.nextRun).toBeInstanceOf(Date);
      });

      it('should validate expression with step values', () => {
        const result = validateCronExpression('*/30 * * * * *');
        expect(result.valid).toBe(true);
      });

      it('should validate expression with ranges', () => {
        const result = validateCronExpression('0 0 9-17 * * 1-5');
        expect(result.valid).toBe(true);
      });

      it('should validate midnight expression', () => {
        const result = validateCronExpression('0 0 0 * * *');
        expect(result.valid).toBe(true);
      });

      it('should validate expression with specific day of week', () => {
        const result = validateCronExpression('0 0 12 * * 0');
        expect(result.valid).toBe(true);
      });
    });

    describe('invalid cron expressions', () => {
      it('should reject 5-field cron expression (missing seconds)', () => {
        const result = validateCronExpression('30 7 * * *');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject invalid second value (60)', () => {
        const result = validateCronExpression('60 0 0 * * *');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject invalid minute value (60)', () => {
        const result = validateCronExpression('0 60 0 * * *');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject invalid hour value (24)', () => {
        const result = validateCronExpression('0 0 24 * * *');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject empty string', () => {
        const result = validateCronExpression('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject non-string input', () => {
        const result = validateCronExpression(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject gibberish input', () => {
        const result = validateCronExpression('not a cron');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('getNextRunTime', () => {
    it('should return next run time for valid expression', () => {
      const nextRun = getNextRunTime('0 30 7 * * *');
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid expression', () => {
      const nextRun = getNextRunTime('invalid');
      expect(nextRun).toBeNull();
    });

    it('should return null for empty expression', () => {
      const nextRun = getNextRunTime('');
      expect(nextRun).toBeNull();
    });
  });
});
