import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerApiRoutes } from '../../../src/web/routes/api.js';

// Mock dependencies
vi.mock('../../../src/services/adb-client.js', () => ({
  getDeviceStatus: vi.fn(() => ({ connected: true })),
  connect: vi.fn(),
  reconnect: vi.fn(),
  getDevice: vi.fn(() => ({ shell: vi.fn() })) 
}));

vi.mock('../../../src/services/scheduler.js', () => ({
  getSchedulerStatus: vi.fn(() => ({ running: true })),
  getJobs: vi.fn(() => [])
}));

vi.mock('../../../src/actions/index.js', () => ({
}));

vi.mock('../../../src/services/executor.js', () => ({
  executeAction: vi.fn(),
  getActivityLog: vi.fn(() => [])
}));

// Mock module.createRequire for api.js
vi.mock('module', () => ({
  createRequire: () => () => ({ version: '1.0.0' })
}));

describe('API Routes', () => {
  let app;
  let routes = {};

  beforeEach(async () => {
    routes = {};
    app = {
      get: vi.fn((path, handler) => routes['GET ' + path] = handler),
      post: vi.fn((path, handler) => routes['POST ' + path] = handler)
    };
    
    // reset mocks
    vi.clearAllMocks();
    
    registerApiRoutes(app);
  });

  // Helper to simulate request
  async function request(method, path, body = {}, params = {}) {
    const handler = routes[method + ' ' + path];
    if (!handler) {
        console.log(`Route not found: ${method} ${path}. Available: ${Object.keys(routes)}`);
        return null; 
    }
    
    const req = { body, params };
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis()
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
});
