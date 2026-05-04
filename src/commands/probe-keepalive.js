import { loadConfig } from '../utils/config.js';
import { createProbeStorage } from '../services/probe-storage.js';
import { createAdbProbeClient, runKeepaliveProbe } from '../services/keepalive-probe.js';
import { logger } from '../utils/logger.js';

const DEFAULT_INTERVAL_MS = 30000;
const DEFAULT_DURATION_MS = 21600000;
const DEFAULT_DB_PATH = '/app/probe-data/keepalive-probe.sqlite';
const DEFAULT_COMMAND = 'echo ping';

function buildTarget(config, options) {
  if (options.target) {
    return options.target;
  }

  const ip = options.ip || config.device.ip;
  const port = options.port || config.device.port;
  return `${ip}:${port}`;
}

export async function probeKeepaliveCommand(options = {}) {
  let storage;

  try {
    const config = await loadConfig();
    const target = buildTarget(config, options);
    const intervalMs = Number(options.intervalMs || DEFAULT_INTERVAL_MS);
    const durationMs = Number(options.durationMs || DEFAULT_DURATION_MS);
    const command = options.command || DEFAULT_COMMAND;
    const dbPath = options.dbPath || DEFAULT_DB_PATH;

    storage = await createProbeStorage({ dbPath });
    const adb = createAdbProbeClient();
    const result = await runKeepaliveProbe({
      target,
      intervalMs,
      durationMs,
      command,
      adb,
      storage
    });

    console.log(`Run ID: ${result.runId}`);
    console.log(`Verdict: ${result.verdict}`);
    console.log(`Samples: ${result.sampleCount}`);
    console.log(`Disconnects: ${result.disconnectCount}`);
    console.log(`Screen Disturbances: ${result.disturbanceCount}`);

    return 0;
  } catch (error) {
    logger.error(`Keepalive probe command failed: ${error.message}`);
    console.error(`Keepalive probe failed: ${error.message}`);
    return 1;
  } finally {
    if (storage) {
      await storage.close();
    }
  }
}
