import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

describe('validate command', () => {
  describe('valid configuration', () => {
    it('should exit 0 for valid config', () => {
      const output = execSync(
        'node src/index.js validate --config config.example.json',
        { encoding: 'utf8' }
      );
      expect(output).toContain('Configuration is valid');
    });

    it('should display device info for valid config', () => {
      const output = execSync(
        'node src/index.js validate --config config.example.json',
        { encoding: 'utf8' }
      );
      expect(output).toContain('Device: 192.168.1.100:5555');
      expect(output).toContain('task(s) configured');
    });
  });

  describe('invalid configuration', () => {
    const invalidConfigPath = join(projectRoot, 'test-invalid-temp.json');

    it('should exit 1 for invalid IP', () => {
      writeFileSync(invalidConfigPath, JSON.stringify({
        device: { ip: 'not-an-ip', port: 5555 },
        tasks: []
      }));

      try {
        execSync(`node src/index.js validate --config ${invalidConfigPath}`, {
          encoding: 'utf8'
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.stdout).toContain('validation failed');
        expect(error.stdout).toContain('/device/ip');
      } finally {
        unlinkSync(invalidConfigPath);
      }
    });

    it('should exit 1 for missing required fields', () => {
      writeFileSync(invalidConfigPath, JSON.stringify({
        device: { ip: '192.168.1.1' }
      }));

      try {
        execSync(`node src/index.js validate --config ${invalidConfigPath}`, {
          encoding: 'utf8'
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.stdout).toContain('validation failed');
      } finally {
        unlinkSync(invalidConfigPath);
      }
    });
  });

  describe('file errors', () => {
    it('should exit 1 for non-existent file', () => {
      try {
        execSync('node src/index.js validate --config nonexistent.json', {
          encoding: 'utf8'
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.stdout).toContain('not found');
      }
    });
  });
});
