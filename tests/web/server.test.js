/**
 * Tests for Web Server Module
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Web Server', () => {
  let WebServer;
  const TEST_PORT = 3999;

  // Track all running servers for proper cleanup
  let activeServers = [];

  beforeEach(async () => {
    // Dynamic import for ES modules
    const module = await import('../../../src/web/server.js');
    WebServer = module.WebServer;
    activeServers = [];
  });

  afterEach(async () => {
    // Clean up all active servers
    for (const server of activeServers) {
      try {
        await server.stop();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    activeServers = [];
  });

  async function createAndStartServer(port = TEST_PORT, options = {}) {
    const server = new WebServer({ port, ...options });
    await server.start();
    activeServers.push(server);
    return server;
  }

  describe('Task 2: Server Creation and Configuration', () => {
    it('2.1 should create a WebServer instance with Express', () => {
      const server = new WebServer();
      expect(server).toBeDefined();
      expect(server.app).toBeDefined();
    });

    it('2.2 should use configurable port via ATV_WEB_PORT (default 3000)', () => {
      const serverDefault = new WebServer();
      expect(serverDefault.port).toBe(3000);

      const serverCustom = new WebServer({ port: TEST_PORT });
      expect(serverCustom.port).toBe(TEST_PORT);
    });

    it('2.3 should serve static files from src/web/public/', async () => {
      // Create test public directory
      const publicDir = path.join(__dirname, '../../src/web/public');
      await fs.mkdir(publicDir, { recursive: true });
      await fs.writeFile(path.join(publicDir, 'test.txt'), 'Hello World');

      const server = await createAndStartServer(TEST_PORT, { staticDir: publicDir });

      // Verify static file serving
      const response = await fetch(`http://localhost:${TEST_PORT}/test.txt`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toBe('Hello World');

      // Cleanup
      await fs.unlink(path.join(publicDir, 'test.txt'));
    });

    it('2.4 should log startup message with host and port', async () => {
      const logs = [];

      // Capture logger.info output
      const module = await import('../../../src/utils/logger.js');
      const originalInfo = module.logger.info;
      module.logger.info = (...args) => logs.push(args);

      await createAndStartServer(TEST_PORT);

      module.logger.info = originalInfo;

      const startupLog = logs.find(log =>
        log.some(arg =>
          typeof arg === 'string' &&
          arg.includes('Web UI available at') &&
          arg.includes('http://') &&
          arg.includes(TEST_PORT.toString())
        )
      );

      expect(startupLog).toBeDefined();
    });
  });

  describe('Task 6: Graceful Shutdown', () => {
    it('6.3 should close HTTP server gracefully on stop', async () => {
      const server = await createAndStartServer(TEST_PORT);

      // Verify server is running
      let response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);

      // Stop server
      await server.stop();
      activeServers = activeServers.filter(s => s !== server);

      // Verify server is stopped
      await expect(
        fetch(`http://localhost:${TEST_PORT}/`)
      ).rejects.toThrow();
    });

    it('6.3 should close all WebSocket connections on stop', async () => {
      const server = await createAndStartServer(TEST_PORT);

      // Create WebSocket connection
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);

      // Wait for WebSocket to open
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(reject, 5000, new Error('WebSocket open timeout'));
      });

      expect(ws.readyState).toBe(1); // OPEN

      const closePromise = new Promise(resolve => {
        ws.onclose = resolve;
      });

      await server.stop();
      activeServers = activeServers.filter(s => s !== server);

      // WebSocket should be closed
      await closePromise;
      expect(ws.readyState).toBe(3); // CLOSED
    });
  });
});
