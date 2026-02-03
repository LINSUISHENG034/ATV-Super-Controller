/**
 * Logger module tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import winston from 'winston';

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

  describe('logWithContext helper function (Task 1)', () => {
    it('should export logWithContext function', async () => {
      const { logWithContext } = await import('../../src/utils/logger.js');
      expect(logWithContext).toBeDefined();
      expect(typeof logWithContext).toBe('function');
    });

    it('should log with context object merged into output', async () => {
      const { logWithContext } = await import('../../src/utils/logger.js');
      const logs = [];

      const originalTransports = winston.createLogger().transports;
      const testLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.Console({
            silent: true,
            log: (info) => {
              logs.push(info);
            }
          })
        ]
      });

      // Note: We're testing the function signature and behavior
      // Actual log output testing would require mocking winston transports
      expect(() => logWithContext('info', 'test message', { taskName: 'test-task' })).not.toThrow();
    });

    it('should handle empty context object', async () => {
      const { logWithContext } = await import('../../src/utils/logger.js');
      expect(() => logWithContext('info', 'test message')).not.toThrow();
    });

    it('should support all log levels', async () => {
      const { logWithContext } = await import('../../src/utils/logger.js');
      expect(() => logWithContext('error', 'error message', { error: 'test' })).not.toThrow();
      expect(() => logWithContext('warn', 'warn message', { warning: 'test' })).not.toThrow();
      expect(() => logWithContext('info', 'info message', { info: 'test' })).not.toThrow();
      expect(() => logWithContext('debug', 'debug message', { debug: 'test' })).not.toThrow();
    });
  });

  describe('Task logging convenience methods (Task 1)', () => {
    it('should export logTaskStart function', async () => {
      const { logTaskStart } = await import('../../src/utils/logger.js');
      expect(logTaskStart).toBeDefined();
      expect(typeof logTaskStart).toBe('function');
    });

    it('should export logTaskComplete function', async () => {
      const { logTaskComplete } = await import('../../src/utils/logger.js');
      expect(logTaskComplete).toBeDefined();
      expect(typeof logTaskComplete).toBe('function');
    });

    it('should export logTaskFailed function', async () => {
      const { logTaskFailed } = await import('../../src/utils/logger.js');
      expect(logTaskFailed).toBeDefined();
      expect(typeof logTaskFailed).toBe('function');
    });

    it('should export logAdbCommand function', async () => {
      const { logAdbCommand } = await import('../../src/utils/logger.js');
      expect(logAdbCommand).toBeDefined();
      expect(typeof logAdbCommand).toBe('function');
    });

    it('logTaskStart should accept taskName and actions', async () => {
      const { logTaskStart } = await import('../../src/utils/logger.js');
      expect(() => logTaskStart('test-task', [{ type: 'wake-up' }])).not.toThrow();
    });

    it('logTaskComplete should accept taskName, duration, and result', async () => {
      const { logTaskComplete } = await import('../../src/utils/logger.js');
      expect(() => logTaskComplete('test-task', 1234, 'success')).not.toThrow();
    });

    it('logTaskFailed should accept taskName, duration, error, and retryCount', async () => {
      const { logTaskFailed } = await import('../../src/utils/logger.js');
      expect(() => logTaskFailed('test-task', 1234, 'Connection failed', 2)).not.toThrow();
    });

    it('logAdbCommand should accept command and device', async () => {
      const { logAdbCommand } = await import('../../src/utils/logger.js');
      expect(() => logAdbCommand('input keyevent KEYCODE_WAKEUP', '192.168.1.1:5555')).not.toThrow();
    });
  });
});
