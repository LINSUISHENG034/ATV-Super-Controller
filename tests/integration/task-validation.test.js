import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, validateConfig, validateTasks } from '../../src/utils/config.js';

const projectRoot = process.cwd();
const testConfigPath = join(projectRoot, 'test-integration-temp.json');

describe('task validation integration', () => {
  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('valid task configurations', () => {
    it('should validate config with valid tasks end-to-end', async () => {
      const config = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: [{
          name: 'morning-routine',
          schedule: '0 30 7 * * *',
          actions: [
            { type: 'wake' },
            { type: 'wait', duration: 5000 },
            { type: 'play-video', url: 'https://youtube.com/watch?v=abc' }
          ]
        }]
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const loaded = await loadConfig(testConfigPath);
      const schemaResult = validateConfig(loaded);
      const taskResult = validateTasks(loaded);

      expect(schemaResult.valid).toBe(true);
      expect(taskResult.valid).toBe(true);
    });
  });

  describe('invalid cron expressions', () => {
    it('should fail for 5-field cron (missing seconds)', async () => {
      const config = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: [{
          name: 'bad-cron',
          schedule: '30 7 * * *',
          actions: [{ type: 'wake' }]
        }]
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const loaded = await loadConfig(testConfigPath);
      const schemaResult = validateConfig(loaded);
      const taskResult = validateTasks(loaded);

      expect(schemaResult.valid).toBe(true);
      expect(taskResult.valid).toBe(false);
      expect(taskResult.errors[0].path).toContain('schedule');
    });
  });

  describe('invalid action types', () => {
    it('should fail for unknown action type', async () => {
      const config = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: [{
          name: 'bad-action',
          schedule: '0 0 0 * * *',
          actions: [{ type: 'unknown-action' }]
        }]
      };
      writeFileSync(testConfigPath, JSON.stringify(config));

      const loaded = await loadConfig(testConfigPath);
      const taskResult = validateTasks(loaded);

      expect(taskResult.valid).toBe(false);
      expect(taskResult.errors[0].message).toContain('Unknown action type');
    });
  });
});
