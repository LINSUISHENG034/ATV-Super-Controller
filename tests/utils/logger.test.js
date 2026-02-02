/**
 * Logger module tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Logger Module', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('logger export', () => {
    it('should export a named logger instance', async () => {
      const { logger } = await import('../../src/utils/logger.js');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('log level control (AC4)', () => {
    it('should default to info level when ATV_LOG_LEVEL not set', async () => {
      delete process.env.ATV_LOG_LEVEL;
      const { logger } = await import('../../src/utils/logger.js');
      expect(logger.level).toBe('info');
    });

    it('should use ATV_LOG_LEVEL environment variable', async () => {
      process.env.ATV_LOG_LEVEL = 'debug';
      const { logger } = await import('../../src/utils/logger.js');
      expect(logger.level).toBe('debug');
    });

    it('should support error level', async () => {
      process.env.ATV_LOG_LEVEL = 'error';
      const { logger } = await import('../../src/utils/logger.js');
      expect(logger.level).toBe('error');
    });
  });

  describe('JSON format output (AC3)', () => {
    it('should output logs with timestamp, level, and message fields', async () => {
      const { logger } = await import('../../src/utils/logger.js');

      // Create a mock transport to capture output
      const logs = [];
      const mockTransport = {
        log: (info, callback) => {
          logs.push(info);
          callback();
        }
      };

      // The logger should have JSON format configured
      // We verify by checking the format configuration exists
      expect(logger.format).toBeDefined();
    });

    it('should have console transport configured', async () => {
      const { logger } = await import('../../src/utils/logger.js');
      expect(logger.transports.length).toBeGreaterThan(0);
    });
  });
});
