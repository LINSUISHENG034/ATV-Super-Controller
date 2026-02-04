/**
 * REST API Routes
 * Defines all API endpoints for the Web UI
 */
import { getDeviceStatus, getDevice, connect, reconnect } from '../../services/adb-client.js';
import { getSchedulerStatus, getJobs } from '../../services/scheduler.js';
import { executeAction, getActivityLog } from '../../services/executor.js';
import { createRequire } from 'module';

// Use createRequire to import package.json (synchronous but at module load time)
const require = createRequire(import.meta.url);
const packageJson = require('../../../package.json');

// Track service start time
let serviceStartTime = Date.now();

/**
 * Register API routes
 * @param {express.Application} app - Express app instance
 */
export function registerApiRoutes(app) {
  /**
   * GET /api/v1/status
   * Returns system status including device, scheduler, and service info
   */
  app.get('/api/v1/status', (req, res) => {
    try {
      const deviceStatus = getDeviceStatus();
      const schedulerStatus = getSchedulerStatus();

      const response = {
        success: true,
        data: {
          device: {
            connected: deviceStatus.connected,
            reconnecting: deviceStatus.reconnecting || false,
            target: deviceStatus.target || null,
            lastConnectedAt: deviceStatus.lastConnectedAt || null
          },
          scheduler: {
            running: schedulerStatus.running,
            taskCount: schedulerStatus.taskCount || 0
          },
          service: {
            version: packageJson.version,
            uptime: Math.floor((Date.now() - serviceStartTime) / 1000)
          }
        }
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: 'Failed to retrieve status',
          details: { reason: error.message }
        }
      });
    }
  });

  /**
   * Health check endpoint
   */
  app.get('/api/v1/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    });
  });

  // --- New Endpoints for Story 6.2 ---

  /**
   * POST /api/v1/actions/:type
   * Trigger a quick action
   */
  app.post('/api/v1/actions/:type', async (req, res) => {
    const { type } = req.params;
    const params = req.body || {};

    try {
      const device = getDevice();
      if (!device) {
         return res.status(503).json({
             success: false,
             error: {
                 code: 'DEVICE_UNAVAILABLE',
                 message: 'No device connected'
             }
         });
      }

      const result = await executeAction(device, type, params);
      
      if (result.success) {
          res.json({
              success: true,
              data: {
                  action: type,
                  status: result.status,
                  duration: result.duration
              }
          });
      } else {
          res.status(500).json({
              success: false,
              error: {
                  code: 'ACTION_FAILED',
                  message: result.error || 'Action failed execution',
                  details: { failedAtIndex: result.failedAtIndex }
              }
          });
      }
    } catch (error) {
       res.status(500).json({
           success: false,
           error: {
               code: 'ACTION_ERROR',
               message: 'Failed to trigger action',
               details: { reason: error.message }
           }
       });
    }
  });

  /**
   * POST /api/v1/device/reconnect
   * Force manual reconnection
   */
  app.post('/api/v1/device/reconnect', async (req, res) => {
      try {
          await reconnect();

          res.json({ success: true, data: { reconnecting: true } });
      } catch (error) {
          res.status(500).json({ success: false, error: { code: 'RECONNECT_FAILED', message: error.message } });
      }
  });

  /**
   * GET /api/v1/tasks
   * List scheduled tasks
   */
  app.get('/api/v1/tasks', (req, res) => {
      try {
          const jobs = getJobs();
          // Transform for UI
          const tasks = jobs.map(job => ({
              name: job.name,
              cron: job.schedule,
              nextRun: job.nextRun ? new Date(job.nextRun).toLocaleString() : 'N/A',
              enabled: true, // Assuming enabled if registered
              actions: job.actions
          }));
          
          res.json({ success: true, data: { tasks } });
      } catch (error) {
          res.status(500).json({ success: false, error: { code: 'TASKS_ERROR', message: error.message } });
      }
  });

  /**
    * GET /api/v1/activity
    * Get recent activity log
    */
   app.get('/api/v1/activity', (req, res) => {
       try {
           res.json({ success: true, data: getActivityLog() });
       } catch (error) {
           res.status(500).json({ success: false, error: { code: 'ACTIVITY_ERROR', message: error.message } });
       }
   });

}
