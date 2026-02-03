/**
 * Status command - shows scheduler service and device connection status
 */
import { connect, getConnectionStatus, getDeviceInfo } from '../services/adb-client.js';
import { isSchedulerRunning, getRegisteredTasks } from '../services/scheduler.js';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Build JSON output object
 */
function buildJsonOutput(serviceRunning, result, connectionStatus, deviceInfo, tasks) {
  return {
    service: {
      status: serviceRunning ? 'running' : 'not running',
      taskCount: tasks.length
    },
    device: {
      status: result.connected ? 'connected' : 'disconnected',
      address: connectionStatus.device || null,
      id: deviceInfo?.id || null,
      lastConnectedAt: connectionStatus.lastConnectedAt?.toISOString() || null
    },
    tasks: tasks.map(task => ({
      name: task.name,
      schedule: task.schedule,
      nextRun: task.nextRun?.toISOString() || null,
      lastRunStatus: task.lastRunStatus || null,
      lastRunTime: task.lastRunTime?.toISOString() || null,
      failureCount: task.failureCount || 0,
      executionHistory: (task.executionHistory || []).map(h => ({
        status: h.status,
        startTime: h.startTime?.toISOString() || null,
        endTime: h.endTime?.toISOString() || null,
        duration: h.duration || null,
        error: h.error || null
      }))
    }))
  };
}

/**
 * Display human-readable output
 */
function displayHumanOutput(serviceRunning, result, connectionStatus, deviceInfo, tasks) {
  // Service status
  if (serviceRunning) {
    console.log('Service: Running');
  } else {
    console.log('Service: Not running');
  }

  console.log('');

  // Device status section
  console.log('Device Status:');
  if (result.connected) {
    if (connectionStatus.reconnecting) {
      console.log(`  Status: Reconnecting`);
      console.log(`  Attempt: ${connectionStatus.reconnectAttempt}`);
    } else {
      console.log(`  Status: Connected`);
    }
    console.log(`  Device: ${connectionStatus.device}`);
    if (deviceInfo) {
      console.log(`  Device ID: ${deviceInfo.id}`);
    }
    if (connectionStatus.lastConnectedAt) {
      console.log(`  Last Connected: ${connectionStatus.lastConnectedAt.toISOString()}`);
    }
  } else {
    if (connectionStatus.reconnecting) {
      console.log(`  Status: Reconnecting`);
      console.log(`  Attempt: ${connectionStatus.reconnectAttempt}`);
    } else {
      console.log(`  Status: Disconnected`);
      console.log(`  Error: ${result.error?.message || 'Unknown error'}`);
    }
  }

  // Scheduled tasks section
  if (tasks.length > 0) {
    console.log('');
    console.log(`Scheduled Tasks (${tasks.length}):`);
    for (const task of tasks) {
      console.log(`  ${task.name}:`);
      console.log(`    Schedule: ${task.schedule}`);
      console.log(`    Next Run: ${task.nextRun ? task.nextRun.toISOString() : '(unknown)'}`);
      if (task.lastRunStatus) {
        console.log(`    Last Run: ${task.lastRunStatus} (${task.lastRunTime?.toISOString() || 'unknown'})`);
      } else {
        console.log(`    Last Run: (never)`);
      }
      // Display failure count
      console.log(`    Failures: ${task.failureCount || 0}`);
      // Display last 3 execution history entries
      if (task.executionHistory && task.executionHistory.length > 0) {
        console.log(`    Recent Executions:`);
        const recentHistory = task.executionHistory.slice(-3).reverse();
        for (const exec of recentHistory) {
          const statusStr = exec.status === 'completed' ? '✓' : '✗';
          const durationStr = `${exec.duration}ms`;
          const timeStr = exec.endTime ? exec.endTime.toLocaleString() : 'unknown';
          console.log(`      ${statusStr} ${exec.status} (${timeStr}) - ${durationStr}`);
          if (exec.error) {
            console.log(`        Error: ${exec.error}`);
          }
        }
      }
    }
  }
}

/**
 * Execute status command
 * @param {object} options - Command options
 * @param {boolean} [options.json] - Output in JSON format
 * @returns {Promise<number>} Exit code (0 = service running, 1 = not running/error)
 */
export async function statusCommand(options = {}) {
  try {
    const config = await loadConfig();
    const { ip, port } = config.device;

    // Check scheduler status first
    const serviceRunning = isSchedulerRunning();

    // Try to connect to device for status
    const result = await connect(ip, port);
    const connectionStatus = getConnectionStatus();
    const deviceInfo = getDeviceInfo();

    // Get task information
    const tasks = getRegisteredTasks();

    // JSON output mode
    if (options.json) {
      const output = buildJsonOutput(serviceRunning, result, connectionStatus, deviceInfo, tasks);
      console.log(JSON.stringify(output, null, 2));
      return serviceRunning ? 0 : 1;
    }

    // Human-readable output
    displayHumanOutput(serviceRunning, result, connectionStatus, deviceInfo, tasks);

    return serviceRunning ? 0 : 1;
  } catch (error) {
    logger.error('Status command failed', { error: error.message });
    if (options.json) {
      console.log(JSON.stringify({ service: { status: 'not running', taskCount: 0 }, error: error.message }));
    } else {
      console.log('Service: Not running');
      console.log('');
      console.log(`Error: ${error.message}`);
    }
    return 1;
  }
}

