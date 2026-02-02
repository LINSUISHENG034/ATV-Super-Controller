import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const cliPath = join(projectRoot, 'src', 'index.js');

describe('CLI Entry Point', () => {
  describe('--version', () => {
    it('should output version number', () => {
      const result = execSync(`node "${cliPath}" --version`, {
        encoding: 'utf-8',
        cwd: projectRoot
      }).trim();

      expect(result).toBe('1.0.0');
    });
  });

  describe('--help', () => {
    it('should display help with all commands', () => {
      const result = execSync(`node "${cliPath}" --help`, {
        encoding: 'utf-8',
        cwd: projectRoot
      });

      expect(result).toContain('atv-controller');
      expect(result).toContain('Android TV scheduler and controller');
      expect(result).toContain('start');
      expect(result).toContain('status');
      expect(result).toContain('test');
      expect(result).toContain('validate');
    });

    it('should show description for start command', () => {
      const result = execSync(`node "${cliPath}" --help`, {
        encoding: 'utf-8',
        cwd: projectRoot
      });

      expect(result).toContain('Start the scheduler service');
    });

    it('should show description for status command', () => {
      const result = execSync(`node "${cliPath}" --help`, {
        encoding: 'utf-8',
        cwd: projectRoot
      });

      expect(result).toContain('Show scheduler and device status');
    });

    it('should show description for test command', () => {
      const result = execSync(`node "${cliPath}" --help`, {
        encoding: 'utf-8',
        cwd: projectRoot
      });

      expect(result).toContain('Test device connection');
    });

    it('should show description for validate command', () => {
      const result = execSync(`node "${cliPath}" --help`, {
        encoding: 'utf-8',
        cwd: projectRoot
      });

      expect(result).toContain('Validate configuration file');
    });
  });
});
