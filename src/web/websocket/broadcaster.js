/**
 * Event Broadcasting Utility
 * Provides event bus for broadcasting messages to WebSocket clients
 */
import { EventEmitter } from 'events';

// Singleton event bus
const eventBus = new EventEmitter();

/**
 * Emit an event for broadcasting to WebSocket clients
 * @param {string} type - Event type (e.g., 'status:device:connected')
 * @param {object} data - Event data payload
 */
export function emitEvent(type, data) {
  eventBus.emit('broadcast', {
    type,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Subscribe to broadcast events
 * @param {Function} callback - Callback function receiving { type, data, timestamp }
 * @returns {Function} Unsubscribe function
 */
export function onBroadcast(callback) {
  eventBus.on('broadcast', callback);
  return () => eventBus.off('broadcast', callback);
}

/**
 * Remove all broadcast listeners (for cleanup)
 */
export function clearBroadcastListeners() {
  eventBus.removeAllListeners('broadcast');
}

export { eventBus };
