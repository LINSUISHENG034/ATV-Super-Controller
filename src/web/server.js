/**
 * Web Server Module
 * Express + WebSocket server for Web UI
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, logEmitter } from '../utils/logger.js';
import { registerRoutes } from './routes/index.js';
import { WebSocketHandler, WS_READY_STATE } from './websocket/handler.js';
import { onBroadcast, clearBroadcastListeners } from './websocket/broadcaster.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WebServer class - manages Express HTTP server and WebSocket server
 */
export class WebServer {
  /**
   * @param {object} options - Server configuration
   * @param {number} [options.port=3000] - HTTP server port
   * @param {string} [options.host='0.0.0.0'] - HTTP server bind address
   * @param {string} [options.staticDir] - Static files directory
   */
  constructor(options = {}) {
    this.port = options.port || parseInt(process.env.ATV_WEB_PORT || '3000', 10);
    this.host = options.host || process.env.ATV_WEB_HOST || '0.0.0.0';
    this.staticDir = options.staticDir || path.join(__dirname, 'public');

    // Express app setup
    this.app = express();
    this.server = null;
    this.wsServer = null;
    this.wsHandler = new WebSocketHandler();
    this.wsClients = new Set();
    this._unsubscribeBroadcast = null;
    this._logHandler = null;
  }

  /**
   * Start the web server
   * @returns {Promise<void>}
   */
  async start() {
    if (this.server) {
      logger.warn('Web server already running');
      return;
    }

    // Configure middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Register all routes
    registerRoutes(this.app);

    // Serve static files
    this.app.use(express.static(this.staticDir));

    // Create HTTP server
    this.server = createServer(this.app);

    // Setup WebSocket server
    this.wsServer = new WebSocketServer({ server: this.server, path: '/ws' });
    this._setupWebSocketHandler();

    // Subscribe to broadcast events
    this._unsubscribeBroadcast = onBroadcast((event) => {
      this._broadcastToSubscribers(event);
    });

    // Subscribe to log events for real-time streaming
    this._logHandler = (logEntry) => {
      this._broadcastLogEntry(logEntry);
    };
    logEmitter.on('log', this._logHandler);

    // Start listening
    await new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    logger.info(`Web UI available at http://${this.host}:${this.port}`);
  }

  /**
   * Stop the web server gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.server) {
      return;
    }

    // Unsubscribe from broadcast events
    if (this._unsubscribeBroadcast) {
      this._unsubscribeBroadcast();
      this._unsubscribeBroadcast = null;
    }

    // Unsubscribe from log events
    if (this._logHandler) {
      logEmitter.off('log', this._logHandler);
      this._logHandler = null;
    }

    // Close all WebSocket connections
    for (const ws of this.wsClients) {
      ws.close(1001, 'Server shutting down');
    }
    this.wsClients.clear();
    this.wsHandler.clear();

    // Close WebSocket server
    if (this.wsServer) {
      await new Promise(resolve => {
        this.wsServer.close(resolve);
      });
      this.wsServer = null;
    }

    // Close HTTP server
    await new Promise(resolve => {
      this.server.close(resolve);
    });

    this.server = null;
    logger.info('Web server stopped');
  }

  /**
   * Setup WebSocket connection handler
   * @private
   */
  _setupWebSocketHandler() {
    this.wsServer.on('connection', (ws, req) => {
      const clientId = this.wsHandler.registerClient(ws);
      this.wsClients.add(ws);

      // Send connection established message
      this._sendToClient(ws, {
        type: 'connection:established',
        data: {
          clientId,
          serverTime: new Date().toISOString()
        }
      });

      // Handle client messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          const result = this.wsHandler.handleMessage(ws, message);
          
          // Send acknowledgment for subscribe/unsubscribe
          if (message.type === 'subscribe' || message.type === 'unsubscribe') {
            this._sendToClient(ws, {
              type: `${message.type}:ack`,
              data: {
                channel: message.channel,
                success: result.success,
                error: result.error
              }
            });
          }
        } catch (error) {
          logger.warn('Invalid WebSocket message', { error: error.message });
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.wsClients.delete(ws);
        const id = this.wsHandler.findClientId(ws);
        if (id) {
          this.wsHandler.unregisterClient(id);
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.warn('WebSocket error', { error: error.message });
        this.wsClients.delete(ws);
        const id = this.wsHandler.findClientId(ws);
        if (id) {
          this.wsHandler.unregisterClient(id);
        }
      });
    });
  }

  /**
   * Broadcast event to subscribed clients
   * @param {object} event - Event object with type, data, timestamp
   * @private
   */
  _broadcastToSubscribers(event) {
    // Extract channel from event type (e.g., 'status:device:connected' -> 'status')
    const channel = event.type.split(':')[0];
    const subscribers = this.wsHandler.getSubscribers(channel);

    const payload = JSON.stringify(event);
    for (const ws of subscribers) {
      ws.send(payload);
    }
  }

  /**
   * Broadcast log entry to clients subscribed to 'logs' channel
   * @param {object} logEntry - Log entry with timestamp, level, message
   * @private
   */
  _broadcastLogEntry(logEntry) {
    const subscribers = this.wsHandler.getSubscribers('logs');
    if (subscribers.length === 0) return;

    const event = {
      type: 'log:entry',
      channel: 'logs',
      data: {
        level: logEntry.level,
        message: logEntry.message
      },
      timestamp: logEntry.timestamp
    };

    const payload = JSON.stringify(event);
    for (const ws of subscribers) {
      ws.send(payload);
    }
  }

  /**
   * Send a message to a specific WebSocket client
   * @param {WebSocket} ws - Client WebSocket connection
   * @param {object} message - Message object to send
   * @private
   */
  _sendToClient(ws, message) {
    if (ws.readyState === WS_READY_STATE.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast a message to all connected WebSocket clients
   * @param {object} message - Message object to broadcast
   * @param {string} [channel] - Optional channel filter
   */
  broadcast(message, channel) {
    const data = channel ? { ...message, channel } : message;
    const payload = JSON.stringify(data);

    for (const ws of this.wsClients) {
      if (ws.readyState === WS_READY_STATE.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Get Express app for route registration
   * @returns {express.Application} Express app instance
   */
  getApp() {
    return this.app;
  }

  /**
   * Check if server is running
   * @returns {boolean} True if server is running
   */
  isRunning() {
    return this.server !== null;
  }
}
