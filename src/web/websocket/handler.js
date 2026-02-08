/**
 * WebSocket Message Handler
 * Handles incoming WebSocket messages and client state management
 */
import { logger } from '../../utils/logger.js';
import { getDevice } from '../../services/adb-client.js';

// WebSocket ready state constants
export const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

// Supported channels
const SUPPORTED_CHANNELS = ['status', 'tasks', 'logs'];

// Allowed keycodes for remote control (security whitelist)
const ALLOWED_KEYCODES = [
  'KEYCODE_DPAD_UP',
  'KEYCODE_DPAD_DOWN',
  'KEYCODE_DPAD_LEFT',
  'KEYCODE_DPAD_RIGHT',
  'KEYCODE_DPAD_CENTER',
  'KEYCODE_BACK',
  'KEYCODE_HOME',
  'KEYCODE_ENTER',
  'KEYCODE_VOLUME_UP',
  'KEYCODE_VOLUME_DOWN',
  'KEYCODE_VOLUME_MUTE',
  'KEYCODE_MEDIA_PLAY_PAUSE',
  'KEYCODE_MEDIA_STOP'
];

/**
 * WebSocket Handler class - manages client connections and subscriptions
 */
export class WebSocketHandler {
  constructor() {
    // Map of clientId -> { ws, subscriptions: Set }
    this.clients = new Map();
  }

  /**
   * Generate a unique client ID
   * @returns {string} Client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Register a new client connection
   * @param {WebSocket} ws - WebSocket connection
   * @returns {string} Client ID
   */
  registerClient(ws) {
    const clientId = this.generateClientId();
    this.clients.set(clientId, {
      ws,
      subscriptions: new Set()
    });
    return clientId;
  }

  /**
   * Unregister a client connection
   * @param {string} clientId - Client ID
   */
  unregisterClient(clientId) {
    this.clients.delete(clientId);
  }

  /**
   * Find client ID by WebSocket instance
   * @param {WebSocket} ws - WebSocket connection
   * @returns {string|null} Client ID or null
   */
  findClientId(ws) {
    for (const [clientId, client] of this.clients) {
      if (client.ws === ws) {
        return clientId;
      }
    }
    return null;
  }

  /**
   * Handle incoming message from client
   * @param {WebSocket} ws - Client WebSocket connection
   * @param {object} message - Parsed message object
   * @returns {{ success: boolean, error?: string }}
   */
  handleMessage(ws, message) {
    const clientId = this.findClientId(ws);
    if (!clientId) {
      return { success: false, error: 'Client not registered' };
    }

    const client = this.clients.get(clientId);

    switch (message.type) {
      case 'subscribe':
        return this._handleSubscribe(client, message.channel, clientId);
      case 'unsubscribe':
        return this._handleUnsubscribe(client, message.channel, clientId);
      case 'remote:key':
        return this._handleRemoteKey(message.keycode, clientId);
      default:
        logger.warn('Unknown WebSocket message type', { type: message.type });
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }

  /**
   * Handle subscribe message
   * @param {object} client - Client state object
   * @param {string} channel - Channel to subscribe to
   * @param {string} clientId - Client ID for logging
   * @returns {{ success: boolean, error?: string }}
   * @private
   */
  _handleSubscribe(client, channel, clientId) {
    if (!channel) {
      return { success: false, error: 'Channel is required' };
    }

    if (!SUPPORTED_CHANNELS.includes(channel)) {
      logger.warn('Client attempted to subscribe to unsupported channel', { clientId, channel });
      return { success: false, error: `Unsupported channel: ${channel}` };
    }

    client.subscriptions.add(channel);
    logger.debug('Client subscribed to channel', { clientId, channel });
    return { success: true };
  }

  /**
   * Handle unsubscribe message
   * @param {object} client - Client state object
   * @param {string} channel - Channel to unsubscribe from
   * @param {string} clientId - Client ID for logging
   * @returns {{ success: boolean, error?: string }}
   * @private
   */
  _handleUnsubscribe(client, channel, clientId) {
    if (!channel) {
      return { success: false, error: 'Channel is required' };
    }

    client.subscriptions.delete(channel);
    logger.debug('Client unsubscribed from channel', { clientId, channel });
    return { success: true };
  }

  /**
   * Handle remote key event (fire-and-forget for low latency)
   * @param {string} keycode - Android keycode to send
   * @param {string} clientId - Client ID for logging
   * @returns {{ success: boolean, error?: string }}
   * @private
   */
  _handleRemoteKey(keycode, clientId) {
    if (!keycode || typeof keycode !== 'string') {
      logger.warn('Remote key missing keycode', { clientId });
      return { success: false, error: 'keycode is required' };
    }

    if (!ALLOWED_KEYCODES.includes(keycode)) {
      logger.warn('Invalid keycode attempted', { clientId, keycode });
      return { success: false, error: 'Invalid keycode' };
    }

    const device = getDevice();
    if (!device) {
      logger.warn('Remote key failed: device disconnected', { clientId, keycode });
      return { success: false, error: 'Device disconnected' };
    }

    // Fire-and-forget: don't wait for completion
    logger.debug('Executing remote key', { clientId, keycode });
    device.shell(`input keyevent ${keycode}`).catch(err => {
      logger.warn('Key event failed', { keycode, error: err.message });
    });

    return { success: true };
  }

  /**
   * Get all clients subscribed to a channel
   * @param {string} channel - Channel name
   * @returns {Array<WebSocket>} Array of WebSocket connections
   */
  getSubscribers(channel) {
    const subscribers = [];
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(channel) && client.ws.readyState === WS_READY_STATE.OPEN) {
        subscribers.push(client.ws);
      }
    }
    return subscribers;
  }

  /**
   * Get all connected clients
   * @returns {Array<WebSocket>} Array of all WebSocket connections
   */
  getAllClients() {
    return Array.from(this.clients.values())
      .filter(client => client.ws.readyState === WS_READY_STATE.OPEN)
      .map(client => client.ws);
  }

  /**
   * Get client count
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Clear all clients (for shutdown)
   */
  clear() {
    this.clients.clear();
  }
}
