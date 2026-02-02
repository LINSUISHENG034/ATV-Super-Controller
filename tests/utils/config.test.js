import { describe, it, expect } from 'vitest';
import { loadConfigFile, validateConfig } from '../../src/utils/config.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

describe('validateConfig', () => {
  describe('valid configurations', () => {
    it('should pass validation for valid config', () => {
      const validConfig = {
        device: { ip: '192.168.1.100', port: 5555 },
        tasks: [{
          name: 'test-task',
          schedule: '0 0 * * *',
          actions: [{ type: 'wake' }]
        }]
      };
      const result = validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should pass validation for config with all action types', () => {
      const config = {
        device: { ip: '10.0.0.1', port: 5555 },
        tasks: [{
          name: 'full-task',
          schedule: '0 30 7 * * *',
          actions: [
            { type: 'wake' },
            { type: 'wait', duration: 5000 },
            { type: 'launch-app', package: 'com.example.app' },
            { type: 'play-video', url: 'https://youtube.com/watch?v=abc' },
            { type: 'shutdown' }
          ]
        }]
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('should fail when device is missing', () => {
      const config = { tasks: [] };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === '' && e.message.includes('device'))).toBe(true);
    });

    it('should fail when device.ip is missing', () => {
      const config = {
        device: { port: 5555 },
        tasks: []
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === '/device' && e.message.includes('ip'))).toBe(true);
    });

    it('should fail when tasks is missing', () => {
      const config = { device: { ip: '192.168.1.1', port: 5555 } };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('tasks'))).toBe(true);
    });
  });

  describe('invalid field values', () => {
    it('should fail for invalid IP address format', () => {
      const config = {
        device: { ip: 'not-an-ip', port: 5555 },
        tasks: []
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === '/device/ip')).toBe(true);
    });

    it('should fail for port out of range (too low)', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 0 },
        tasks: []
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === '/device/port')).toBe(true);
    });

    it('should fail for port out of range (too high)', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 70000 },
        tasks: []
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === '/device/port')).toBe(true);
    });

    it('should fail for empty task name', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 5555 },
        tasks: [{
          name: '',
          schedule: '0 0 * * *',
          actions: []
        }]
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('name'))).toBe(true);
    });

    it('should pass for task name with spaces and special chars', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 5555 },
        tasks: [{
          name: 'My Custom Task!',
          schedule: '0 0 * * *',
          actions: [{ type: 'wake' }]
        }]
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('action type validation', () => {
    it('should fail for invalid action type', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 5555 },
        tasks: [{
          name: 'test',
          schedule: '0 0 * * *',
          actions: [{ type: 'invalid-action' }]
        }]
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should fail when wait action missing duration', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 5555 },
        tasks: [{
          name: 'test',
          schedule: '0 0 * * *',
          actions: [{ type: 'wait' }]
        }]
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should fail when play-video action missing url', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 5555 },
        tasks: [{
          name: 'test',
          schedule: '0 0 * * *',
          actions: [{ type: 'play-video' }]
        }]
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should fail when launch-app action missing package', () => {
      const config = {
        device: { ip: '192.168.1.1', port: 5555 },
        tasks: [{
          name: 'test',
          schedule: '0 0 * * *',
          actions: [{ type: 'launch-app' }]
        }]
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });
  });
});
