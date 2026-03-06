import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerApiRoutes } from '../../../src/web/routes/api.js';

const mockActions = {};

// Mock dependencies
vi.mock('../../../src/services/adb-client.js', () => ({
  getDeviceStatus: vi.fn(() => ({ connected: true })),
  connect: vi.fn(),
  reconnect: vi.fn(),
  captureScreen: vi.fn(),
  getDevice: vi.fn(() => ({
    shell: vi.fn(),
    push: vi.fn(),
    pull: vi.fn()
  }))
}));

vi.mock('../../../src/services/scheduler.js', () => ({
  getSchedulerStatus: vi.fn(() => ({ running: true })),
  getJobs: vi.fn(() => []),
  setTaskEnabled: vi.fn((name, enabled) => ({ name, enabled })),
  getTaskDetails: vi.fn((name) => ({ name, schedule: '0 0 * * *', actions: [] }))
}));

vi.mock('../../../src/actions/index.js', () => ({
  listActions: vi.fn(() => Object.keys(mockActions)),
  getAction: vi.fn((type) => mockActions[type])
}));

vi.mock('../../../src/services/app-manager.js', () => ({
  listInstalledApps: vi.fn(() => []),
  getAppApkPath: vi.fn(() => '/data/app/test/base.apk')
}));

vi.mock('../../../src/services/executor.js', () => ({
  executeAction: vi.fn(),
  executeTask: vi.fn(),
  getActivityLog: vi.fn(() => []),
  getActionContext: vi.fn(() => ({ youtube: { apiKey: 'test-key' } }))
}));

vi.mock('../../../src/utils/logger.js', () => ({
  getRecentLogs: vi.fn(() => ({ logs: [], hasMore: false }))
}));

// Mock module.createRequire for api.js
vi.mock('module', () => ({
  createRequire: () => () => ({ version: '1.0.0' })
}));

describe('API Routes', () => {
  let app;
  let routes = {};

  beforeEach(async () => {
    Object.keys(mockActions).forEach(key => delete mockActions[key]);
    mockActions.wake = { name: 'wake', execute: vi.fn().mockResolvedValue({ success: true }) };
    mockActions['launch-app'] = { name: 'launch-app', execute: vi.fn().mockResolvedValue({ success: true }) };
    mockActions['force-stop'] = { name: 'force-stop', execute: vi.fn().mockResolvedValue({ success: true }) };
    mockActions['clear-cache'] = { name: 'clear-cache', execute: vi.fn().mockResolvedValue({ success: true }) };
    mockActions['uninstall-app'] = { name: 'uninstall-app', execute: vi.fn().mockResolvedValue({ success: true }) };

    routes = {};
    app = {
      get: vi.fn((path, handler) => routes['GET ' + path] = handler),
      post: vi.fn((path, handler) => routes['POST ' + path] = handler),
      patch: vi.fn((path, handler) => routes['PATCH ' + path] = handler),
      put: vi.fn((path, handler) => routes['PUT ' + path] = handler),
      delete: vi.fn((path, handler) => routes['DELETE ' + path] = handler)
    };
    
    // reset mocks
    vi.clearAllMocks();
    
    registerApiRoutes(app);
  });

  // Helper to simulate request
  async function request(method, path, body = {}, params = {}, query = {}) {
    const handler = routes[method + ' ' + path];
    if (!handler) {
        console.log(`Route not found: ${method} ${path}. Available: ${Object.keys(routes)}`);
        return null;
    }

    const req = { body, params, query };
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      end: vi.fn(),
      headersSent: false
    };
    await handler(req, res);
    return res;
  }

  describe('Quick Actions', () => {
    it('should register POST /api/v1/actions/wake', async () => {
      const executeAction = (await import('../../../src/services/executor.js')).executeAction;
      executeAction.mockResolvedValue({ status: 'completed', success: true });

      const res = await request('POST', '/api/v1/actions/:type', {}, { type: 'wake' });
      expect(res).not.toBeNull();
      
      expect(executeAction).toHaveBeenCalledWith(expect.anything(), 'wake', expect.anything());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ action: 'wake' })
      }));
    });

    it('should register POST /api/v1/actions/shutdown', async () => {
        const executeAction = (await import('../../../src/services/executor.js')).executeAction;
        executeAction.mockResolvedValue({ status: 'completed', success: true });
  
        const res = await request('POST', '/api/v1/actions/:type', {}, { type: 'shutdown' });
        expect(res).not.toBeNull();
        
        expect(executeAction).toHaveBeenCalledWith(expect.anything(), 'shutdown', expect.anything());
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true
        }));
    });

    it('should register POST /api/v1/actions/launch', async () => {
        const executeAction = (await import('../../../src/services/executor.js')).executeAction;
        executeAction.mockResolvedValue({ status: 'completed', success: true });
  
        const res = await request('POST', '/api/v1/actions/:type', { package: 'com.google.android.youtube' }, { type: 'launch' });
        expect(res).not.toBeNull();
        
        expect(executeAction).toHaveBeenCalledWith(expect.anything(), 'launch', expect.objectContaining({ package: 'com.google.android.youtube' }));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true
        }));
    });

    it('should handle action execution errors', async () => {
        const executeAction = (await import('../../../src/services/executor.js')).executeAction;
        executeAction.mockRejectedValue(new Error('Device offline'));
  
        const res = await request('POST', '/api/v1/actions/:type', {}, { type: 'wake' });
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          error: expect.objectContaining({
              code: 'ACTION_ERROR'
          })
        }));
    });
  });

  describe('Device Control', () => {
      it('should register POST /api/v1/device/reconnect', async () => {
          const reconnect = (await import('../../../src/services/adb-client.js')).reconnect;
          reconnect.mockResolvedValue({ success: true });

          const res = await request('POST', '/api/v1/device/reconnect');
          expect(res).not.toBeNull();
          
          expect(reconnect).toHaveBeenCalled();
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: true
          }));
      });
  });

  describe('Tasks & Activity', () => {
      it('should register GET /api/v1/tasks', async () => {
          const getJobs = (await import('../../../src/services/scheduler.js')).getJobs;
          getJobs.mockReturnValue([
              { name: 'Test Task', nextInvocation: () => ({ toDate: () => new Date() }) }
          ]);

          const res = await request('GET', '/api/v1/tasks');
          expect(res).not.toBeNull();

          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: true,
              data: expect.objectContaining({
                  tasks: expect.any(Array)
              })
          }));
      });

      it('should register GET /api/v1/activity', async () => {
          const getActivityLog = (await import('../../../src/services/executor.js')).getActivityLog;
          getActivityLog.mockReturnValue([
              { time: '12:00:00', type: 'INFO', message: 'Test activity' }
          ]);

          const res = await request('GET', '/api/v1/activity');
          expect(res).not.toBeNull();

          expect(getActivityLog).toHaveBeenCalled();
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: true,
              data: expect.any(Array)
          }));
      });
  });

  // Story 6.3: Task Management Tests
  describe('Task Management (Story 6.3)', () => {
      describe('PATCH /api/v1/tasks/:name', () => {
          it('should enable a task', async () => {
              const setTaskEnabled = (await import('../../../src/services/scheduler.js')).setTaskEnabled;
              setTaskEnabled.mockReturnValue({ name: 'test-task', enabled: true });

              const res = await request('PATCH', '/api/v1/tasks/:name', { enabled: true }, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(setTaskEnabled).toHaveBeenCalledWith('test-task', true);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: true,
                  data: expect.objectContaining({
                      name: 'test-task',
                      enabled: true
                  })
              }));
          });

          it('should disable a task', async () => {
              const setTaskEnabled = (await import('../../../src/services/scheduler.js')).setTaskEnabled;
              setTaskEnabled.mockReturnValue({ name: 'test-task', enabled: false });

              const res = await request('PATCH', '/api/v1/tasks/:name', { enabled: false }, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(setTaskEnabled).toHaveBeenCalledWith('test-task', false);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: true,
                  data: expect.objectContaining({
                      enabled: false
                  })
              }));
          });

          it('should return validation error when enabled is not a boolean', async () => {
              const res = await request('PATCH', '/api/v1/tasks/:name', { enabled: 'yes' }, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(400);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'VALIDATION_ERROR'
                  })
              }));
          });

          it('should return TASK_NOT_FOUND when task does not exist', async () => {
              const getTaskDetails = (await import('../../../src/services/scheduler.js')).getTaskDetails;
              getTaskDetails.mockReturnValue(null);

              const res = await request('PATCH', '/api/v1/tasks/:name', { enabled: true }, { name: 'non-existent' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(404);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'TASK_NOT_FOUND'
                  })
              }));
          });

          it('should handle toggle error and rollback on failure', async () => {
              const setTaskEnabled = (await import('../../../src/services/scheduler.js')).setTaskEnabled;
              const getTaskDetails = (await import('../../../src/services/scheduler.js')).getTaskDetails;

              // Mock task as existing
              getTaskDetails.mockReturnValue({ name: 'test-task', schedule: '0 0 * * *', actions: [] });
              setTaskEnabled.mockImplementation(() => {
                  throw new Error('Scheduler error');
              });

              const res = await request('PATCH', '/api/v1/tasks/:name', { enabled: true }, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(500);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'TASK_TOGGLE_ERROR'
                  })
              }));
          });
      });

      describe('POST /api/v1/tasks/:name/run', () => {
          it('should run a task immediately when device is connected', async () => {
              const executeTask = (await import('../../../src/services/executor.js')).executeTask;
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const getTaskDetails = (await import('../../../src/services/scheduler.js')).getTaskDetails;

              // Ensure device is "connected" and task exists
              getDevice.mockReturnValue({ shell: vi.fn() });
              getTaskDetails.mockReturnValue({ name: 'test-task', schedule: '0 0 * * *', actions: [] });

              executeTask.mockResolvedValue({ success: true, status: 'completed', duration: 100 });

              const res = await request('POST', '/api/v1/tasks/:name/run', {}, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(executeTask).toHaveBeenCalled();
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: true,
                  data: expect.objectContaining({
                      taskName: 'test-task',
                      status: 'triggered'
                  })
              }));
          });

          it('should return DEVICE_DISCONNECTED when no device connected', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              getDevice.mockReturnValue(null);

              const res = await request('POST', '/api/v1/tasks/:name/run', {}, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(503);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'DEVICE_DISCONNECTED'
                  })
              }));
          });

          it('should return TASK_NOT_FOUND when task does not exist', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const getTaskDetails = (await import('../../../src/services/scheduler.js')).getTaskDetails;

              // Ensure device is "connected"
              getDevice.mockReturnValue({ shell: vi.fn() });
              getTaskDetails.mockReturnValue(null);

              const res = await request('POST', '/api/v1/tasks/:name/run', {}, { name: 'non-existent' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(404);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'TASK_NOT_FOUND'
                  })
              }));
          });

          it('should handle task execution failure', async () => {
              const executeTask = (await import('../../../src/services/executor.js')).executeTask;
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const getTaskDetails = (await import('../../../src/services/scheduler.js')).getTaskDetails;

              // Ensure device is "connected" and task exists
              getDevice.mockReturnValue({ shell: vi.fn() });
              getTaskDetails.mockReturnValue({ name: 'test-task', schedule: '0 0 * * *', actions: [] });

              executeTask.mockResolvedValue({
                  success: false,
                  status: 'failed',
                  error: 'Action failed',
                  failedAction: 'wake'
              });

              const res = await request('POST', '/api/v1/tasks/:name/run', {}, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(500);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'TASK_EXECUTION_FAILED'
                  })
              }));
          });

          it('should handle network errors when running task', async () => {
              const executeTask = (await import('../../../src/services/executor.js')).executeTask;
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const getTaskDetails = (await import('../../../src/services/scheduler.js')).getTaskDetails;

              // Ensure device is "connected" and task exists
              getDevice.mockReturnValue({ shell: vi.fn() });
              getTaskDetails.mockReturnValue({ name: 'test-task', schedule: '0 0 * * *', actions: [] });

              executeTask.mockRejectedValue(new Error('Network error'));

              const res = await request('POST', '/api/v1/tasks/:name/run', {}, { name: 'test-task' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(500);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'TASK_RUN_ERROR'
                  })
              }));
          });

          it('should pass action context to executeTask', async () => {
              const executeTask = (await import('../../../src/services/executor.js')).executeTask;
              const getActionContext = (await import('../../../src/services/executor.js')).getActionContext;
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const getTaskDetails = (await import('../../../src/services/scheduler.js')).getTaskDetails;

              // Setup mocks
              getDevice.mockReturnValue({ shell: vi.fn() });
              getTaskDetails.mockReturnValue({ name: 'test-task', schedule: '0 0 * * *', actions: [{ type: 'wake' }] });
              executeTask.mockResolvedValue({ success: true, status: 'completed', duration: 100 });

              const res = await request('POST', '/api/v1/tasks/:name/run', {}, { name: 'test-task' });
              expect(res).not.toBeNull();

              // Verify executeTask was called with context (not empty object)
              expect(executeTask).toHaveBeenCalledWith(
                  expect.objectContaining({ name: 'test-task' }),
                  expect.anything(),
                  expect.any(Object)
              );
          });
      });
  });

  // Story 6.4: Remote Control Tests
  describe('Remote Control (Story 6.4)', () => {
      describe('POST /api/v1/remote/key', () => {
          it('should send a valid keycode to the device', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const mockShell = vi.fn().mockResolvedValue({ on: vi.fn((event, cb) => { if (event === 'end') cb(); }) });
              getDevice.mockReturnValue({ shell: mockShell });

              const res = await request('POST', '/api/v1/remote/key', { keycode: 'KEYCODE_DPAD_UP' });
              expect(res).not.toBeNull();

              expect(mockShell).toHaveBeenCalledWith('input keyevent KEYCODE_DPAD_UP');
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: true,
                  data: expect.objectContaining({
                      keycode: 'KEYCODE_DPAD_UP',
                      sent: true
                  })
              }));
          });

          it('should send KEYCODE_DPAD_CENTER for OK button', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const mockShell = vi.fn().mockResolvedValue({ on: vi.fn((event, cb) => { if (event === 'end') cb(); }) });
              getDevice.mockReturnValue({ shell: mockShell });

              const res = await request('POST', '/api/v1/remote/key', { keycode: 'KEYCODE_DPAD_CENTER' });
              expect(res).not.toBeNull();

              expect(mockShell).toHaveBeenCalledWith('input keyevent KEYCODE_DPAD_CENTER');
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: true
              }));
          });

          it('should return VALIDATION_ERROR when keycode is missing', async () => {
              const res = await request('POST', '/api/v1/remote/key', {});
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(400);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'VALIDATION_ERROR'
                  })
              }));
          });

          it('should return VALIDATION_ERROR when keycode is not a string', async () => {
              const res = await request('POST', '/api/v1/remote/key', { keycode: 123 });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(400);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'VALIDATION_ERROR'
                  })
              }));
          });

          it('should return INVALID_KEYCODE for disallowed keycodes', async () => {
              const res = await request('POST', '/api/v1/remote/key', { keycode: 'KEYCODE_POWER' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(400);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'INVALID_KEYCODE'
                  })
              }));
          });

          it('should return DEVICE_DISCONNECTED when no device connected', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              getDevice.mockReturnValue(null);

              const res = await request('POST', '/api/v1/remote/key', { keycode: 'KEYCODE_DPAD_UP' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(503);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'DEVICE_DISCONNECTED'
                  })
              }));
          });

          it('should handle shell execution errors', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const mockShell = vi.fn().mockRejectedValue(new Error('ADB error'));
              getDevice.mockReturnValue({ shell: mockShell });

              const res = await request('POST', '/api/v1/remote/key', { keycode: 'KEYCODE_HOME' });
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(500);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'KEY_SEND_ERROR'
                  })
              }));
          });

          it('should accept all navigation keycodes', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const mockShell = vi.fn().mockResolvedValue({ on: vi.fn((event, cb) => { if (event === 'end') cb(); }) });
              getDevice.mockReturnValue({ shell: mockShell });

              const navKeycodes = [
                  'KEYCODE_DPAD_UP',
                  'KEYCODE_DPAD_DOWN',
                  'KEYCODE_DPAD_LEFT',
                  'KEYCODE_DPAD_RIGHT'
              ];

              for (const keycode of navKeycodes) {
                  const res = await request('POST', '/api/v1/remote/key', { keycode });
                  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                      success: true
                  }));
              }
          });

          it('should accept volume keycodes', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const mockShell = vi.fn().mockResolvedValue({ on: vi.fn((event, cb) => { if (event === 'end') cb(); }) });
              getDevice.mockReturnValue({ shell: mockShell });

              const volumeKeycodes = [
                  'KEYCODE_VOLUME_UP',
                  'KEYCODE_VOLUME_DOWN',
                  'KEYCODE_VOLUME_MUTE'
              ];

              for (const keycode of volumeKeycodes) {
                  const res = await request('POST', '/api/v1/remote/key', { keycode });
                  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                      success: true
                  }));
              }
          });

          it('should accept media keycodes', async () => {
              const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
              const mockShell = vi.fn().mockResolvedValue({ on: vi.fn((event, cb) => { if (event === 'end') cb(); }) });
              getDevice.mockReturnValue({ shell: mockShell });

              const mediaKeycodes = [
                  'KEYCODE_MEDIA_PLAY_PAUSE',
                  'KEYCODE_MEDIA_STOP'
              ];

              for (const keycode of mediaKeycodes) {
                  const res = await request('POST', '/api/v1/remote/key', { keycode });
                  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                      success: true
                  }));
              }
          });
      });
  });

  describe('App Manager', () => {
      it('should return installed apps list', async () => {
          const { listInstalledApps } = await import('../../../src/services/app-manager.js');
          listInstalledApps.mockResolvedValue([
              { package: 'com.test.app', name: 'Test App', version: '1.0.0', size: 1024, path: '/data/app/test/base.apk' }
          ]);

          const res = await request('GET', '/api/v1/apps');
          expect(res).not.toBeNull();
          expect(listInstalledApps).toHaveBeenCalled();
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: true,
              data: expect.objectContaining({
                  apps: expect.any(Array)
              })
          }));
      });

      it('should register POST /api/v1/apps/install endpoint', () => {
          expect(app.post).toHaveBeenCalledWith('/api/v1/apps/install', expect.any(Function));
      });

      it('should return DEVICE_DISCONNECTED when installing without device', async () => {
          const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
          getDevice.mockReturnValue(null);

          const handler = routes['POST /api/v1/apps/install'];
          const req = { setTimeout: vi.fn() };
          const res = {
              setTimeout: vi.fn(),
              status: vi.fn().mockReturnThis(),
              json: vi.fn()
          };

          await handler(req, res);

          expect(res.status).toHaveBeenCalledWith(503);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: false,
              error: expect.objectContaining({ code: 'DEVICE_DISCONNECTED' })
          }));
      });

      it('should force-stop an app package', async () => {
          const { getAction } = await import('../../../src/actions/index.js');
          const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
          getDevice.mockReturnValue({ shell: vi.fn() });

          const res = await request('POST', '/api/v1/apps/:pkg/stop', {}, { pkg: 'com.test.app' });
          expect(res).not.toBeNull();

          expect(getAction).toHaveBeenCalledWith('force-stop');
          expect(mockActions['force-stop'].execute).toHaveBeenCalledWith(
              expect.anything(),
              expect.objectContaining({ package: 'com.test.app' }),
              expect.any(Object)
          );
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: true,
              data: expect.objectContaining({ status: 'stopped' })
          }));
      });

      it('should uninstall an app package', async () => {
          const { getAction } = await import('../../../src/actions/index.js');
          const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
          getDevice.mockReturnValue({ shell: vi.fn() });

          const res = await request('DELETE', '/api/v1/apps/:pkg', {}, { pkg: 'com.test.app' });
          expect(res).not.toBeNull();

          expect(getAction).toHaveBeenCalledWith('uninstall-app');
          expect(mockActions['uninstall-app'].execute).toHaveBeenCalledWith(
              expect.anything(),
              expect.objectContaining({ package: 'com.test.app' }),
              expect.any(Object)
          );
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: true,
              data: expect.objectContaining({ status: 'uninstalled' })
          }));
      });

      it('should reject invalid package names for app actions', async () => {
          const getDevice = (await import('../../../src/services/adb-client.js')).getDevice;
          getDevice.mockReturnValue({ shell: vi.fn() }); // Ensure device is connected

          const res = await request('POST', '/api/v1/apps/:pkg/launch', {}, { pkg: '../bad' });
          expect(res).not.toBeNull();
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
              success: false,
              error: expect.objectContaining({ code: 'INVALID_PACKAGE' })
          }));
      });
  });

  // Story 6.5: Log Viewer Tests
  describe('Log Viewer (Story 6.5)', () => {
      describe('GET /api/v1/logs', () => {
          it('should return logs with default parameters', async () => {
              const getRecentLogs = (await import('../../../src/utils/logger.js')).getRecentLogs;
              getRecentLogs.mockReturnValue({
                  logs: [
                      { timestamp: '2026-02-05T10:00:00Z', level: 'INFO', message: 'Test log' }
                  ],
                  hasMore: false
              });

              const res = await request('GET', '/api/v1/logs');
              expect(res).not.toBeNull();

              expect(getRecentLogs).toHaveBeenCalledWith({
                  level: undefined,
                  limit: 100,
                  since: undefined
              });
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: true,
                  data: expect.objectContaining({
                      logs: expect.any(Array),
                      hasMore: false
                  })
              }));
          });

          it('should filter logs by level', async () => {
              const getRecentLogs = (await import('../../../src/utils/logger.js')).getRecentLogs;
              getRecentLogs.mockReturnValue({ logs: [], hasMore: false });

              const res = await request('GET', '/api/v1/logs', {}, {}, { level: 'error' });
              expect(res).not.toBeNull();

              expect(getRecentLogs).toHaveBeenCalledWith({
                  level: 'error',
                  limit: 100,
                  since: undefined
              });
          });

          it('should respect limit query parameter', async () => {
              const getRecentLogs = (await import('../../../src/utils/logger.js')).getRecentLogs;
              getRecentLogs.mockReturnValue({ logs: [], hasMore: false });

              const res = await request('GET', '/api/v1/logs', {}, {}, { limit: '50' });
              expect(res).not.toBeNull();

              expect(getRecentLogs).toHaveBeenCalledWith({
                  level: undefined,
                  limit: 50,
                  since: undefined
              });
          });

          it('should use default limit for invalid values', async () => {
              const getRecentLogs = (await import('../../../src/utils/logger.js')).getRecentLogs;
              getRecentLogs.mockReturnValue({ logs: [], hasMore: false });

              const res = await request('GET', '/api/v1/logs', {}, {}, { limit: 'invalid' });
              expect(res).not.toBeNull();

              expect(getRecentLogs).toHaveBeenCalledWith({
                  level: undefined,
                  limit: 100,
                  since: undefined
              });
          });

          it('should filter logs by since timestamp', async () => {
              const getRecentLogs = (await import('../../../src/utils/logger.js')).getRecentLogs;
              getRecentLogs.mockReturnValue({ logs: [], hasMore: false });

              const since = '2026-02-05T09:00:00Z';
              const res = await request('GET', '/api/v1/logs', {}, {}, { since });
              expect(res).not.toBeNull();

              expect(getRecentLogs).toHaveBeenCalledWith({
                  level: undefined,
                  limit: 100,
                  since
              });
          });

          it('should handle errors gracefully', async () => {
              const getRecentLogs = (await import('../../../src/utils/logger.js')).getRecentLogs;
              getRecentLogs.mockImplementation(() => {
                  throw new Error('Buffer error');
              });

              const res = await request('GET', '/api/v1/logs');
              expect(res).not.toBeNull();

              expect(res.status).toHaveBeenCalledWith(500);
              expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: false,
                  error: expect.objectContaining({
                      code: 'LOGS_ERROR'
                  })
              }));
          });
      });
  });
});
