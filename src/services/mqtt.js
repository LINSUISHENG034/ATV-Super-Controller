/**
 * MQTT Service
 * Handles connection to MQTT broker and Home Assistant Auto-Discovery
 */
import mqtt from 'mqtt';
import { logger } from '../utils/logger.js';
import { emitEvent } from '../web/websocket/broadcaster.js';

let client = null;
let currentConfig = null;
let currentExecutor = null;

/**
 * Clean up topic names for MQTT (replace spaces/special chars)
 * @param {string} name - Raw name
 * @returns {string} Sanitized name
 */
function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Initialize MQTT connection and setup handlers
 * @param {object} config - Application configuration
 * @param {Function} executor - Function to execute tasks
 */
export function initMqtt(config, executor) {
  if (!config.mqtt || !config.mqtt.url) {
    logger.debug('MQTT configuration missing or incomplete, skipping initialization.');
    return;
  }

  currentConfig = config;
  currentExecutor = executor;

  const { url, username, password, topic_prefix = 'homeassistant' } = config.mqtt;

  logger.info(`Connecting to MQTT broker at ${url}...`);

  const mqttOptions = {
    reconnectPeriod: 5000,
    clientId: `atv_controller_${Math.random().toString(16).substring(2, 8)}`
  };

  if (username) mqttOptions.username = username;
  if (password) mqttOptions.password = password;

  client = mqtt.connect(url, mqttOptions);

  client.on('connect', () => {
    logger.info('Connected to MQTT broker');
    publishAutoDiscovery(topic_prefix);
    
    // Subscribe to all task command topics
    if (config.tasks && Array.isArray(config.tasks)) {
      config.tasks.forEach(task => {
        const taskId = sanitizeName(task.name);
        const commandTopic = `${topic_prefix}/button/atv_super_controller_${taskId}/set`;
        client.subscribe(commandTopic, (err) => {
          if (err) {
            logger.error(`Failed to subscribe to ${commandTopic}: ${err.message}`);
          } else {
            logger.debug(`Subscribed to command topic: ${commandTopic}`);
          }
        });
      });
    }

    // Broadcast status to web UI
    emitEvent('system:status', { mqtt: 'connected' });
  });

  client.on('message', async (topic, message) => {
    logger.debug(`Received MQTT message on ${topic}: ${message.toString()}`);
    
    // Example topic: homeassistant/button/atv_super_controller_morning_routine/set
    const prefix = `${topic_prefix}/button/atv_super_controller_`;
    if (topic.startsWith(prefix) && topic.endsWith('/set')) {
      const payload = message.toString();
      if (payload === 'PRESS') {
        const taskIdStr = topic.substring(prefix.length, topic.length - 4); // Remove prefix and '/set'
        
        // Find matching task by sanitized name
        const task = currentConfig.tasks.find(t => sanitizeName(t.name) === taskIdStr);
        
        if (task) {
          logger.info(`MQTT command received to execute task: ${task.name}`);
          if (currentExecutor) {
            // Execute in background so we don't block the MQTT message handler
            currentExecutor(task).catch(err => {
              logger.error(`Error executing task ${task.name} via MQTT:`, err);
            });
          }
        } else {
          logger.warn(`Received MQTT command for unknown task: ${taskIdStr}`);
        }
      }
    }
  });

  client.on('error', (err) => {
    logger.error('MQTT connection error:', err);
    emitEvent('system:status', { mqtt: 'error' });
  });

  client.on('offline', () => {
    logger.warn('MQTT client offline, waiting to reconnect...');
    emitEvent('system:status', { mqtt: 'disconnected' });
  });
}

/**
 * Publish Home Assistant Auto-Discovery configuration for all tasks
 * @param {string} prefix - The HA discovery prefix (usually 'homeassistant')
 */
function publishAutoDiscovery(prefix) {
  if (!client || !client.connected || !currentConfig.tasks) {
    return;
  }

  const deviceConfig = {
    identifiers: ['atv_super_controller'],
    name: 'ATV Super Controller',
    manufacturer: 'ATV Super Controller',
    model: 'Virtual Macro Router',
    sw_version: '1.0.0'
  };

  currentConfig.tasks.forEach(task => {
    const taskId = sanitizeName(task.name);
    const configTopic = `${prefix}/button/atv_super_controller_${taskId}/config`;
    const commandTopic = `${prefix}/button/atv_super_controller_${taskId}/set`;
    
    const payload = {
      name: task.name,
      unique_id: `atv_super_controller_${taskId}`,
      command_topic: commandTopic,
      payload_press: 'PRESS',
      device: deviceConfig,
      icon: 'mdi:play-circle-outline'
    };

    client.publish(configTopic, JSON.stringify(payload), { retain: true }, (err) => {
      if (err) {
        logger.error(`Failed to publish HA discovery config for ${task.name}: ${err.message}`);
      } else {
        logger.debug(`Published HA discovery config for ${task.name}`);
      }
    });
  });
}

/**
 * Stop the MQTT service gracefully
 */
export async function stopMqtt() {
  if (client) {
    return new Promise((resolve) => {
      client.end(false, {}, () => {
        logger.info('MQTT connection closed.');
        client = null;
        resolve();
      });
    });
  }
  return Promise.resolve();
}
