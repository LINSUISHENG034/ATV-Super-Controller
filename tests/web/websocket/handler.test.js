/**
 * Tests for WebSocket Handler
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('WebSocket Handler', () => {
  let WebServer;
  const TEST_PORT = 3997;

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

  describe('Task 4: WebSocket Connection', () => {
    it('4.3 WebSocket server attaches at /ws path', async () => {
      await createAndStartServer(TEST_PORT);

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(reject, 5000, new Error('WebSocket connection timeout'));
      });

      expect(ws.readyState).toBe(1); // OPEN
      ws.close();
    });

    it('4.4 Server sends connection:established message on connection', async () => {
      await createAndStartServer(TEST_PORT);

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);

      const message = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          try {
            resolve(JSON.parse(data.toString()));
          } catch (e) {
            reject(e);
          }
        });
        ws.on('error', reject);
        setTimeout(reject, 5000, new Error('WebSocket message timeout'));
      });

      expect(message).toHaveProperty('type', 'connection:established');
      expect(message).toHaveProperty('data');
      expect(message.data).toHaveProperty('clientId');
      expect(message.data).toHaveProperty('serverTime');

      ws.close();
    });

    it('4.5 Handles subscribe/unsubscribe messages with acknowledgment', async () => {
      await createAndStartServer(TEST_PORT);

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      const messages = [];
      
      // Setup message collector before connection
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Wait for connection
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(reject, 5000, new Error('WebSocket connection timeout'));
      });

      // Wait a bit for connection:established message
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(messages[0]).toHaveProperty('type', 'connection:established');

      // Send subscribe message
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'status' }));
      
      // Wait for ack
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const subscribeAck = messages[1];
      expect(subscribeAck).toHaveProperty('type', 'subscribe:ack');
      expect(subscribeAck.data).toHaveProperty('channel', 'status');
      expect(subscribeAck.data).toHaveProperty('success', true);

      // Send unsubscribe message
      ws.send(JSON.stringify({ type: 'unsubscribe', channel: 'status' }));
      
      // Wait for ack
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const unsubscribeAck = messages[2];
      expect(unsubscribeAck).toHaveProperty('type', 'unsubscribe:ack');
      expect(unsubscribeAck.data).toHaveProperty('channel', 'status');
      expect(unsubscribeAck.data).toHaveProperty('success', true);

      ws.close();
    });

    it('4.5 Rejects subscription to unsupported channel', async () => {
      await createAndStartServer(TEST_PORT);

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      const messages = [];

      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(reject, 5000, new Error('WebSocket connection timeout'));
      });

      // Wait for connection:established
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to subscribe to unsupported channel
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'invalid' }));
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const ack = messages[1];
      expect(ack).toHaveProperty('type', 'subscribe:ack');
      expect(ack.data).toHaveProperty('success', false);
      expect(ack.data).toHaveProperty('error');

      ws.close();
    });
  });
});
