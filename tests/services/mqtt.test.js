import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mqtt from 'mqtt';
import { initMqtt, stopMqtt } from '../../src/services/mqtt.js';
import { emitEvent } from '../../src/web/websocket/broadcaster.js';

vi.mock('mqtt');
vi.mock('../../src/web/websocket/broadcaster.js', () => ({
  emitEvent: vi.fn()
}));

describe('MQTT Service', () => {
  let mockClient;
  let eventHandlers;

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers = {};
    
    // Setup mock MQTT client
    mockClient = {
      on: vi.fn((event, handler) => {
        eventHandlers[event] = handler;
        return mockClient;
      }),
      subscribe: vi.fn((topic, cb) => cb && cb(null)),
      publish: vi.fn((topic, payload, options, cb) => cb && cb(null)),
      end: vi.fn((force, options, cb) => cb && cb(null)),
      connected: true
    };
    
    mqtt.connect.mockReturnValue(mockClient);
  });

  afterEach(async () => {
    await stopMqtt();
  });

  it('should not connect if mqtt config is missing', () => {
    initMqtt({ device: { ip: '1.2.3.4' } }, vi.fn());
    expect(mqtt.connect).not.toHaveBeenCalled();
  });

  it('should not connect if mqtt url is missing', () => {
    initMqtt({ 
      device: { ip: '1.2.3.4' },
      mqtt: { username: 'test' }
    }, vi.fn());
    expect(mqtt.connect).not.toHaveBeenCalled();
  });

  it('should connect using provided config', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
        username: 'user',
        password: 'pass'
      },
      tasks: []
    };
    
    initMqtt(config, vi.fn());
    
    expect(mqtt.connect).toHaveBeenCalledWith(
      'mqtt://localhost:1883',
      expect.objectContaining({
        username: 'user',
        password: 'pass'
      })
    );
  });

  it('should publish auto-discovery payloads on connect', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
        topic_prefix: 'ha'
      },
      tasks: [
        { name: 'Morning Routine' },
        { name: 'Night Shutdown' }
      ]
    };
    
    initMqtt(config, vi.fn());
    
    // Simulate connect event
    expect(eventHandlers.connect).toBeDefined();
    eventHandlers.connect();
    
    expect(mockClient.publish).toHaveBeenCalledTimes(2);
    expect(mockClient.publish.mock.calls[0][0]).toBe('ha/button/atv_super_controller_morning_routine/config');
    expect(mockClient.publish.mock.calls[1][0]).toBe('ha/button/atv_super_controller_night_shutdown/config');
  });

  it('should subscribe to command topics on connect', () => {
    const config = {
      mqtt: { url: 'mqtt://localhost:1883' },
      tasks: [ { name: 'My Task' } ]
    };
    
    initMqtt(config, vi.fn());
    eventHandlers.connect();
    
    expect(mockClient.subscribe).toHaveBeenCalledTimes(1);
    expect(mockClient.subscribe).toHaveBeenCalledWith('homeassistant/button/atv_super_controller_my_task/set', expect.any(Function));
  });

  it('should invoke executor when receiving PRESS command', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(true);
    const config = {
      mqtt: { url: 'mqtt://localhost:1883' },
      tasks: [ { name: 'Test Task' } ]
    };
    
    initMqtt(config, mockExecutor);
    
    // Simulate incoming message
    expect(eventHandlers.message).toBeDefined();
    await eventHandlers.message('homeassistant/button/atv_super_controller_test_task/set', Buffer.from('PRESS'));
    
    expect(mockExecutor).toHaveBeenCalledTimes(1);
    expect(mockExecutor).toHaveBeenCalledWith(config.tasks[0]);
  });

  it('should ignore messages on unknown topics', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(true);
    const config = {
      mqtt: { url: 'mqtt://localhost:1883' },
      tasks: [ { name: 'Test Task' } ]
    };
    
    initMqtt(config, mockExecutor);
    
    // Wrong prefix
    await eventHandlers.message('some/other/topic', Buffer.from('PRESS'));
    // Wrong task name
    await eventHandlers.message('homeassistant/button/atv_super_controller_unknown_task/set', Buffer.from('PRESS'));
    // Wrong payload
    await eventHandlers.message('homeassistant/button/atv_super_controller_test_task/set', Buffer.from('OTHER'));
    
    expect(mockExecutor).not.toHaveBeenCalled();
  });
});
