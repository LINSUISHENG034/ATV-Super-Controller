/**
 * Tests for API Routes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('API Routes', () => {
  let WebServer;
  const TEST_PORT = 3998;

  // Track all running servers for proper cleanup
  let activeServers = [];

  beforeEach(async () => {
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

  describe('Task 3: REST API Routes', () => {
    it('3.3 GET /api/v1/status returns JSON response', async () => {
      await createAndStartServer(TEST_PORT);

      const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
    });

    it('3.4 status response includes device and scheduler state', async () => {
      await createAndStartServer(TEST_PORT);

      const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/status`);
      const data = await response.json();

      expect(data.data).toHaveProperty('device');
      expect(data.data).toHaveProperty('scheduler');
      expect(data.data).toHaveProperty('service');

      // Device state structure
      expect(data.data.device).toHaveProperty('connected');
      expect(data.data.device).toHaveProperty('reconnecting');

      // Scheduler state structure
      expect(data.data.scheduler).toHaveProperty('running');
      expect(data.data.scheduler).toHaveProperty('taskCount');

      // Service info structure
      expect(data.data.service).toHaveProperty('version');
      expect(data.data.service).toHaveProperty('uptime');
    });
  });
});
