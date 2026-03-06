/**
 * REST API Routes
 * Defines all API endpoints for the Web UI
 */
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import AdbKit from '@devicefarmer/adbkit';
import multer from 'multer';
import { getDeviceStatus, getDevice, connect, reconnect, captureScreen } from '../../services/adb-client.js';
import { getSchedulerStatus, getJobs, setTaskEnabled, getTaskDetails, addTask, updateTaskConfig, removeTask } from '../../services/scheduler.js';
import { executeAction, executeTask, getActivityLog, getActionContext } from '../../services/executor.js';
import { getRecentLogs } from '../../utils/logger.js';
import { addTask as addTaskToConfig, updateTask as updateTaskInConfig, deleteTask as deleteTaskFromConfig } from '../../services/config-persistence.js';
import { validateCronExpression } from '../../utils/cron-validator.js';
import { listActions, getAction } from '../../actions/index.js';
import { listInstalledApps, getAppApkPath } from '../../services/app-manager.js';
import { shellQuote, isValidPackageName } from '../../utils/shell.js';
import { createRequire } from 'module';

// Use createRequire to import package.json (synchronous but at module load time)
const require = createRequire(import.meta.url);
const packageJson = require('../../../package.json');

// Track service start time
let serviceStartTime = Date.now();

const APK_EXTENSION_PATTERN = /\.apk$/i;

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB
  }
});

/**
 * Validate and decode package route parameter
 */
function parsePackageParam(rawValue) {
  const packageName = decodeURIComponent(rawValue || '');
  if (!isValidPackageName(packageName)) {
    const error = new Error('Invalid package name');
    error.code = 'INVALID_PACKAGE';
    throw error;
  }
  return packageName;
}

/**
 * Get connected device or return a consistent API error
 * @param {object} res - Express response
 * @returns {object|null} Device when connected, else null
 */
function getDeviceOrRespond(res) {
  const device = getDevice();
  if (!device) {
    res.status(503).json({
      success: false,
      error: {
        code: 'DEVICE_DISCONNECTED',
        message: 'No device connected'
      }
    });
    return null;
  }
  return device;
}

/**
 * Execute an action module directly to preserve action-level payloads
 * @param {object} device - Connected device
 * @param {string} type - Registered action name
 * @param {object} params - Action params
 * @returns {Promise<object>} Action result
 */
async function executeRegisteredAction(device, type, params = {}) {
  const action = getAction(type);
  if (!action) {
    const error = new Error(`Unknown action type: ${type}`);
    error.code = 'UNKNOWN_ACTION';
    throw error;
  }
  return action.execute(device, { type, ...params }, getActionContext());
}

/**
 * Await completion of an adb push/pull transfer
 * @param {object} transfer - adbkit transfer stream
 * @returns {Promise<void>}
 */
function waitForTransfer(transfer) {
  return new Promise((resolve, reject) => {
    transfer.on('end', resolve);
    transfer.on('error', reject);
  });
}

/**
 * Run multer single-file middleware within async route handlers
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @returns {Promise<void>}
 */
function runApkUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('apk')(req, res, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Parse package names from `pm list packages -3`
 * @param {string} output - Command output
 * @returns {Set<string>} Parsed package names
 */
function parsePackageSet(output) {
  return new Set(
    output
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('package:'))
      .map(line => line.slice('package:'.length).trim())
      .filter(Boolean)
  );
}

/**
 * Get third-party package set for install-diff detection
 * @param {object} device - Connected device
 * @returns {Promise<Set<string>>} Current package set
 */
async function readThirdPartyPackages(device) {
  const stream = await device.shell('pm list packages -3');
  const output = (await AdbKit.Adb.util.readAll(stream)).toString().trim();
  return parsePackageSet(output);
}

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

  // --- App Manager Endpoints ---

  /**
   * GET /api/v1/apps
   * List installed third-party apps with metadata
   */
  app.get('/api/v1/apps', async (req, res) => {
    try {
      const apps = await listInstalledApps();
      res.json({
        success: true,
        data: { apps }
      });
    } catch (error) {
      if (error.code === 'DEVICE_NOT_CONNECTED') {
        return res.status(503).json({
          success: false,
          error: {
            code: 'DEVICE_DISCONNECTED',
            message: 'No device connected'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'APPS_LIST_ERROR',
          message: 'Failed to list installed apps',
          details: { reason: error.message }
        }
      });
    }
  });

  /**
   * POST /api/v1/apps/install
   * Upload and install an APK
   */
  app.post('/api/v1/apps/install', async (req, res) => {
    // Extend timeout for large APK uploads (10 minutes)
    req.setTimeout(600000);
    res.setTimeout(600000);

    const device = getDeviceOrRespond(res);
    if (!device) {
      return;
    }

    let localPath;
    let remotePath;
    let beforePackages = new Set();

    try {
      await runApkUpload(req, res);
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'APK_REQUIRED',
            message: 'APK file is required (multipart field: apk)'
          }
        });
      }

      localPath = req.file.path;
      const originalName = req.file.originalname || '';
      if (!APK_EXTENSION_PATTERN.test(originalName)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Only .apk files are supported'
          }
        });
      }

      const safeBaseName = path.basename(req.file.filename).replace(/[^A-Za-z0-9._-]/g, '');
      remotePath = `/data/local/tmp/${safeBaseName}.apk`;

      // Check available storage space
      const fileSize = req.file.size;
      const dfStream = await device.shell('df /data/local/tmp | tail -1');
      const dfOutput = (await AdbKit.Adb.util.readAll(dfStream)).toString();
      const dfMatch = dfOutput.match(/\s+(\d+)\s+\d+%/);
      if (dfMatch) {
        const availableKb = parseInt(dfMatch[1], 10);
        const requiredKb = Math.ceil(fileSize / 1024) + 1024; // Add 1MB buffer
        if (availableKb < requiredKb) {
          return res.status(507).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_STORAGE',
              message: 'Not enough storage space on device',
              details: { available: availableKb * 1024, required: fileSize }
            }
          });
        }
      }

      try {
        beforePackages = await readThirdPartyPackages(device);
      } catch (error) {
        beforePackages = new Set();
      }

      const pushTransfer = await device.push(localPath, remotePath);
      await waitForTransfer(pushTransfer);

      const installResult = await executeRegisteredAction(device, 'install-app', { apkPath: remotePath });
      if (!installResult.success) {
        return res.status(500).json({
          success: false,
          error: installResult.error
        });
      }

      let detectedPackage = null;
      try {
        const afterPackages = await readThirdPartyPackages(device);
        detectedPackage = Array.from(afterPackages).find(name => !beforePackages.has(name)) || null;
      } catch (error) {
        detectedPackage = null;
      }

      res.status(201).json({
        success: true,
        data: {
          status: 'installed',
          package: detectedPackage,
          details: installResult.data || {}
        }
      });
    } catch (error) {
      const code = error.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
      res.status(code).json({
        success: false,
        error: {
          code: code === 413 ? 'FILE_TOO_LARGE' : 'APP_INSTALL_ERROR',
          message: code === 413 ? 'APK file exceeds upload limit' : 'Failed to install APK',
          details: { reason: error.message }
        }
      });
    } finally {
      if (remotePath) {
        try {
          const stream = await device.shell(`rm -f ${shellQuote(remotePath)}`);
          await AdbKit.Adb.util.readAll(stream);
        } catch (cleanupError) {
          // Ignore cleanup failures to avoid masking install result
        }
      }
      if (localPath) {
        await fs.unlink(localPath).catch(() => {});
      }
    }
  });

  /**
   * POST /api/v1/apps/:pkg/launch
   * Launch app using existing launch-app action
   */
  app.post('/api/v1/apps/:pkg/launch', async (req, res) => {
    const device = getDeviceOrRespond(res);
    if (!device) {
      return;
    }

    try {
      const packageName = parsePackageParam(req.params.pkg);
      const result = await executeRegisteredAction(device, 'launch-app', { package: packageName });

      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        data: {
          package: packageName,
          status: 'launched'
        }
      });
    } catch (error) {
      const statusCode = error.code === 'INVALID_PACKAGE' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 400 ? 'INVALID_PACKAGE' : 'APP_LAUNCH_ERROR',
          message: statusCode === 400 ? 'Invalid package name' : 'Failed to launch app',
          details: { reason: error.message }
        }
      });
    }
  });

  /**
   * POST /api/v1/apps/:pkg/stop
   * Force stop app process
   */
  app.post('/api/v1/apps/:pkg/stop', async (req, res) => {
    const device = getDeviceOrRespond(res);
    if (!device) {
      return;
    }

    try {
      const packageName = parsePackageParam(req.params.pkg);
      const result = await executeRegisteredAction(device, 'force-stop', { package: packageName });

      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        data: {
          package: packageName,
          status: 'stopped'
        }
      });
    } catch (error) {
      const statusCode = error.code === 'INVALID_PACKAGE' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 400 ? 'INVALID_PACKAGE' : 'APP_STOP_ERROR',
          message: statusCode === 400 ? 'Invalid package name' : 'Failed to stop app',
          details: { reason: error.message }
        }
      });
    }
  });

  /**
   * POST /api/v1/apps/:pkg/clear
   * Clear app cache/data
   */
  app.post('/api/v1/apps/:pkg/clear', async (req, res) => {
    const device = getDeviceOrRespond(res);
    if (!device) {
      return;
    }

    try {
      const packageName = parsePackageParam(req.params.pkg);
      const result = await executeRegisteredAction(device, 'clear-cache', { package: packageName });

      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        data: {
          package: packageName,
          status: 'cleared'
        }
      });
    } catch (error) {
      const statusCode = error.code === 'INVALID_PACKAGE' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 400 ? 'INVALID_PACKAGE' : 'APP_CLEAR_ERROR',
          message: statusCode === 400 ? 'Invalid package name' : 'Failed to clear app cache',
          details: { reason: error.message }
        }
      });
    }
  });

  /**
   * DELETE /api/v1/apps/:pkg
   * Uninstall an app package
   */
  app.delete('/api/v1/apps/:pkg', async (req, res) => {
    const device = getDeviceOrRespond(res);
    if (!device) {
      return;
    }

    try {
      const packageName = parsePackageParam(req.params.pkg);
      const result = await executeRegisteredAction(device, 'uninstall-app', { package: packageName });

      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        data: {
          package: packageName,
          status: 'uninstalled'
        }
      });
    } catch (error) {
      const statusCode = error.code === 'INVALID_PACKAGE' ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 400 ? 'INVALID_PACKAGE' : 'APP_UNINSTALL_ERROR',
          message: statusCode === 400 ? 'Invalid package name' : 'Failed to uninstall app',
          details: { reason: error.message }
        }
      });
    }
  });

  /**
   * GET /api/v1/apps/:pkg/pull
   * Download installed APK
   */
  app.get('/api/v1/apps/:pkg/pull', async (req, res) => {
    const device = getDeviceOrRespond(res);
    if (!device) {
      return;
    }

    try {
      const packageName = parsePackageParam(req.params.pkg);
      const apkPath = await getAppApkPath(packageName);
      const stream = await device.pull(apkPath);
      const downloadName = `${packageName}.apk`;

      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('X-Download-Warning', 'verify-file-integrity');

      stream.on('error', (error) => {
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: {
              code: 'APK_PULL_ERROR',
              message: 'Failed to pull APK',
              details: { reason: error.message }
            }
          });
          return;
        }
        // Destroy response to signal incomplete download to client
        res.destroy();
      });

      stream.pipe(res);
    } catch (error) {
      if (error.code === 'INVALID_PACKAGE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PACKAGE',
            message: 'Invalid package name'
          }
        });
      }

      if (error.code === 'PACKAGE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PACKAGE_NOT_FOUND',
            message: error.message
          }
        });
      }

      if (error.code === 'DEVICE_NOT_CONNECTED') {
        return res.status(503).json({
          success: false,
          error: {
            code: 'DEVICE_DISCONNECTED',
            message: 'No device connected'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'APK_PULL_ERROR',
          message: 'Failed to pull APK',
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
          'force-stop': { type: 'force-stop', params: [{ name: 'package', type: 'string', required: true, label: 'Package Name' }] },
          'clear-cache': { type: 'clear-cache', params: [{ name: 'package', type: 'string', required: true, label: 'Package Name' }] },
          'install-app': { type: 'install-app', params: [{ name: 'apkPath', type: 'string', required: true, label: 'APK Path' }] },
          'uninstall-app': { type: 'uninstall-app', params: [{ name: 'package', type: 'string', required: true, label: 'Package Name' }] },
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
