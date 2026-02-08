/**
 * REST API Routes
 * Defines all API endpoints for the Web UI
 */
import { getDeviceStatus, getDevice, connect, reconnect, captureScreen } from '../../services/adb-client.js';
import { getSchedulerStatus, getJobs, setTaskEnabled, getTaskDetails, addTask, updateTaskConfig, removeTask } from '../../services/scheduler.js';
import { executeAction, executeTask, getActivityLog, getActionContext } from '../../services/executor.js';
import { getRecentLogs } from '../../utils/logger.js';
import { addTask as addTaskToConfig, updateTask as updateTaskInConfig, deleteTask as deleteTaskFromConfig } from '../../services/config-persistence.js';
import { validateCronExpression } from '../../utils/cron-validator.js';
import { listActions, getAction } from '../../actions/index.js';
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
          // Transform for UI - use actual enabled state from scheduler
          const tasks = jobs.map(job => ({
              name: job.name,
              cron: job.schedule,
              nextRun: job.nextRun || 'Disabled',
              enabled: job.enabled,
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

  // --- Story 6.3: Task Management Endpoints ---

  /**
   * PATCH /api/v1/tasks/:name
   * Enable or disable a task
   */
  app.patch('/api/v1/tasks/:name', (req, res) => {
      try {
          const { name } = req.params;
          const { enabled } = req.body;

          // Validate request body
          if (typeof enabled !== 'boolean') {
              return res.status(400).json({
                  success: false,
                  error: {
                      code: 'VALIDATION_ERROR',
                      message: 'enabled field must be a boolean',
                      details: { received: typeof enabled }
                  }
              });
          }

          // Check if task exists
          const task = getTaskDetails(name);
          if (!task) {
              return res.status(404).json({
                  success: false,
                  error: {
                      code: 'TASK_NOT_FOUND',
                      message: `Task '${name}' not found`,
                      details: { taskName: name }
                  }
              });
          }

          // Set task enabled state
          const result = setTaskEnabled(name, enabled);

          res.json({
              success: true,
              data: {
                  name: result.name,
                  enabled: result.enabled
              }
          });
      } catch (error) {
          res.status(500).json({
              success: false,
              error: {
                  code: 'TASK_TOGGLE_ERROR',
                  message: 'Failed to toggle task',
                  details: { reason: error.message }
              }
          });
      }
  });

  // --- Story 6.4: Remote Control Endpoint ---

  /**
   * Allowed keycodes for remote control
   */
  const ALLOWED_KEYCODES = [
    // Navigation
    'KEYCODE_DPAD_UP',
    'KEYCODE_DPAD_DOWN',
    'KEYCODE_DPAD_LEFT',
    'KEYCODE_DPAD_RIGHT',
    'KEYCODE_DPAD_CENTER',
    // Control
    'KEYCODE_BACK',
    'KEYCODE_HOME',
    'KEYCODE_ENTER',
    // Volume
    'KEYCODE_VOLUME_UP',
    'KEYCODE_VOLUME_DOWN',
    'KEYCODE_VOLUME_MUTE',
    // Media
    'KEYCODE_MEDIA_PLAY_PAUSE',
    'KEYCODE_MEDIA_STOP'
  ];

  /**
   * POST /api/v1/remote/key
   * Send a key event to the connected device
   */
  app.post('/api/v1/remote/key', async (req, res) => {
    const { keycode } = req.body;

    // Validate request body has keycode
    if (!keycode || typeof keycode !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'keycode field is required and must be a string',
          details: { received: typeof keycode }
        }
      });
    }

    // Validate keycode is in allowed list
    if (!ALLOWED_KEYCODES.includes(keycode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_KEYCODE',
          message: `Keycode '${keycode}' is not allowed`,
          details: { allowedKeycodes: ALLOWED_KEYCODES }
        }
      });
    }

    // Check device connection
    const device = getDevice();
    if (!device) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DEVICE_DISCONNECTED',
          message: 'No device connected',
          details: { keycode }
        }
      });
    }

    try {
      // Execute ADB shell command and wait for stream to complete
      const stream = await device.shell(`input keyevent ${keycode}`);
      
      // Consume and wait for the stream to complete
      await new Promise((resolve, reject) => {
        stream.on('data', () => {}); // Consume data
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      res.json({
        success: true,
        data: {
          keycode,
          sent: true
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'KEY_SEND_ERROR',
          message: 'Failed to send key event',
          details: { keycode, reason: error.message }
        }
      });
    }
  });

  /**
   * GET /api/v1/remote/screenshot
   * Capture and return a screenshot from the connected device
   */
  app.get('/api/v1/remote/screenshot', async (req, res) => {
    try {
      const result = await captureScreen();

      if (result.success) {
        res.json({
          success: true,
          data: {
            image: result.image,
            timestamp: result.timestamp,
            size: result.size
          }
        });
      } else {
        res.status(503).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SCREENSHOT_ERROR',
          message: 'Failed to capture screenshot',
          details: { reason: error.message }
        }
      });
    }
  });

  /**
   * POST /api/v1/tasks/:name/run
   * Run a task immediately
   */
  app.post('/api/v1/tasks/:name/run', async (req, res) => {
      const { name } = req.params;

      try {
          // Check if device is connected
          const device = getDevice();
          if (!device) {
              return res.status(503).json({
                  success: false,
                  error: {
                      code: 'DEVICE_DISCONNECTED',
                      message: 'No device connected',
                      details: { taskName: name }
                  }
              });
          }

          // Check if task exists
          const task = getTaskDetails(name);
          if (!task) {
              return res.status(404).json({
                  success: false,
                  error: {
                      code: 'TASK_NOT_FOUND',
                      message: `Task '${name}' not found`,
                      details: { taskName: name }
                  }
              });
          }

          // Execute the task
          const result = await executeTask(task, device, getActionContext());

          if (result.success) {
              res.json({
                  success: true,
                  data: {
                      taskName: name,
                      status: 'triggered',
                      message: 'Task executed successfully',
                      duration: result.duration
                  }
              });
          } else {
              res.status(500).json({
                  success: false,
                  error: {
                      code: 'TASK_EXECUTION_FAILED',
                      message: result.error || 'Task execution failed',
                      details: {
                          taskName: name,
                          failedAction: result.failedAction
                      }
                  }
              });
          }
      } catch (error) {
          res.status(500).json({
              success: false,
              error: {
                  code: 'TASK_RUN_ERROR',
                  message: 'Failed to run task',
                  details: { reason: error.message }
              }
          });
      }
  });

  // --- Story 6.5: Log Viewer Endpoint ---

  /**
   * GET /api/v1/logs
   * Retrieve recent logs with optional filtering
   */
  app.get('/api/v1/logs', (req, res) => {
    try {
      const { level, limit, since } = req.query;

      // Parse limit (default 100, max 500)
      let parsedLimit = 100;
      if (limit !== undefined) {
        parsedLimit = parseInt(limit, 10);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
          parsedLimit = 100;
        }
      }

      const result = getRecentLogs({
        level: level || undefined,
        limit: parsedLimit,
        since: since || undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGS_ERROR',
          message: 'Failed to retrieve logs',
          details: { reason: error.message }
        }
      });
    }
  });

  // --- Task CRUD Endpoints ---

  /**
   * GET /api/v1/actions
   * List available action types with their schemas
   */
  app.get('/api/v1/actions', (req, res) => {
    try {
      const actionTypes = listActions();
      const actions = actionTypes.map(type => {
        const schemas = {
          'wake': { type: 'wake', params: [] },
          'wait': { type: 'wait', params: [{ name: 'duration', type: 'number', required: true, label: 'Duration (ms)' }] },
          'play-video': { type: 'play-video', params: [{ name: 'url', type: 'string', required: true, label: 'Video URL' }] },
          'launch-app': { type: 'launch-app', params: [
            { name: 'package', type: 'string', required: true, label: 'Package Name' },
            { name: 'activity', type: 'string', required: false, label: 'Activity (optional)' }
          ]},
          'shutdown': { type: 'shutdown', params: [] },
          'prevent-adb-timeout': { type: 'prevent-adb-timeout', params: [] }
        };
        return schemas[type] || { type, params: [] };
      });

      res.json({ success: true, data: { actions } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'ACTIONS_ERROR', message: error.message }
      });
    }
  });

  /**
   * POST /api/v1/tasks
   * Create a new task
   */
  app.post('/api/v1/tasks', async (req, res) => {
    try {
      const { name, schedule, actions } = req.body;

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Task name is required' }
        });
      }

      if (!schedule || typeof schedule !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Schedule is required' }
        });
      }

      // Validate cron expression
      const cronResult = validateCronExpression(schedule);
      if (!cronResult.valid) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CRON', message: cronResult.error }
        });
      }

      if (!actions || !Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'At least one action is required' }
        });
      }

      // Validate action types
      for (const action of actions) {
        if (!getAction(action.type)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ACTION', message: `Unknown action type: ${action.type}` }
          });
        }
      }

      const task = { name: name.trim(), schedule, actions };

      // Save to config file
      await addTaskToConfig(task);

      // Register with scheduler
      const result = addTask(task);
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: { code: 'SCHEDULER_ERROR', message: result.error }
        });
      }

      res.status(201).json({
        success: true,
        data: { task: name, nextRun: result.nextRun }
      });
    } catch (error) {
      if (error.code === 'TASK_EXISTS') {
        return res.status(409).json({
          success: false,
          error: { code: 'TASK_EXISTS', message: error.message }
        });
      }
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_ERROR', message: error.message }
      });
    }
  });

  /**
   * PUT /api/v1/tasks/:name
   * Update an existing task
   */
  app.put('/api/v1/tasks/:name', async (req, res) => {
    try {
      const { name: taskName } = req.params;
      const { name, schedule, actions } = req.body;

      // Check if task exists
      const existingTask = getTaskDetails(taskName);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: `Task '${taskName}' not found` }
        });
      }

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Task name is required' }
        });
      }

      // Validate cron expression
      const cronResult = validateCronExpression(schedule);
      if (!cronResult.valid) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CRON', message: cronResult.error }
        });
      }

      // Validate actions
      if (!actions || !Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'At least one action is required' }
        });
      }

      for (const action of actions) {
        if (!getAction(action.type)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_ACTION', message: `Unknown action type: ${action.type}` }
          });
        }
      }

      const updatedTask = { name: name.trim(), schedule, actions };

      // Update in config file
      await updateTaskInConfig(taskName, updatedTask);

      // Update in scheduler
      const result = updateTaskConfig(taskName, updatedTask);
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: { code: 'SCHEDULER_ERROR', message: result.error }
        });
      }

      res.json({
        success: true,
        data: { task: name, nextRun: result.nextRun }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ERROR', message: error.message }
      });
    }
  });

  /**
   * DELETE /api/v1/tasks/:name
   * Delete a task
   */
  app.delete('/api/v1/tasks/:name', async (req, res) => {
    try {
      const { name } = req.params;

      // Check if task exists
      const existingTask = getTaskDetails(name);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: `Task '${name}' not found` }
        });
      }

      // Remove from config file
      await deleteTaskFromConfig(name);

      // Remove from scheduler
      const result = removeTask(name);
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: { code: 'SCHEDULER_ERROR', message: result.error }
        });
      }

      res.json({
        success: true,
        data: { task: name, deleted: true }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_ERROR', message: error.message }
      });
    }
  });

}
