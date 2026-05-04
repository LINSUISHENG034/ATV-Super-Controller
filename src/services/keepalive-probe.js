import AdbKit from '@devicefarmer/adbkit';
import { logger } from '../utils/logger.js';
import { parsePowerState, detectScreenDisturbance } from '../utils/power-state-parser.js';
import { summarizeRunSamples } from './probe-storage.js';

const Adb = AdbKit.Adb;

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function computeProbeIterations(durationMs, intervalMs) {
  if (!intervalMs || intervalMs <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(durationMs / intervalMs));
}

async function readAll(stream) {
  const buffer = await Adb.util.readAll(stream);
  return buffer.toString().trim();
}

function normalizeErrorSample(error) {
  return {
    adbAlive: false,
    shellSuccess: false,
    powerOutput: '',
    displayOutput: '',
    errorMessage: error.message
  };
}

async function runKeepaliveProbe({
  target,
  intervalMs,
  durationMs,
  command,
  adb,
  storage,
  sleep = defaultSleep
}) {
  const runId = await storage.createRun({
    target,
    intervalMs,
    durationMs,
    command
  });

  const samples = [];
  let previousState = null;
  let verdict = 'invalid_baseline';

  try {
    if (typeof adb.connect === 'function') {
      await adb.connect(target);
    }

    const iterations = computeProbeIterations(durationMs, intervalMs);

    for (let probeIndex = 0; probeIndex <= iterations; probeIndex++) {
      const phase = probeIndex === 0 ? 'baseline' : 'probe';
      const startedAt = Date.now();

      let rawSample;
      try {
        rawSample = await adb.sample({ target, command, phase, sampleIndex: probeIndex });
      } catch (error) {
        rawSample = normalizeErrorSample(error);
      }

      const latencyMs = Date.now() - startedAt;
      const parsedState = parsePowerState({
        powerOutput: rawSample.powerOutput,
        displayOutput: rawSample.displayOutput
      });
      const disturbanceDetected = detectScreenDisturbance(previousState, parsedState);

      const sample = {
        sampleIndex: probeIndex,
        phase,
        adbAlive: rawSample.adbAlive !== false,
        shellSuccess: rawSample.shellSuccess !== false,
        disturbanceDetected,
        interactive: parsedState.interactive,
        wakefulness: parsedState.wakefulness,
        displayState: parsedState.displayState,
        screenOnGuess: parsedState.screenOnGuess,
        latencyMs: rawSample.latencyMs ?? latencyMs,
        errorMessage: rawSample.errorMessage || null,
        powerOutput: rawSample.powerOutput || '',
        displayOutput: rawSample.displayOutput || '',
        sampledAt: rawSample.sampledAt || new Date().toISOString()
      };

      samples.push(sample);
      await storage.appendSample(runId, sample);
      previousState = parsedState;

      if (probeIndex < iterations) {
        await sleep(intervalMs);
      }
    }

    const summary = summarizeRunSamples(samples);
    verdict = summary.verdict;

    await storage.completeRun(runId, {
      endedAt: new Date().toISOString(),
      verdict,
      disconnectCount: summary.disconnectCount,
      disturbanceCount: summary.disturbanceCount,
      notes: ''
    });

    return {
      runId,
      verdict,
      sampleCount: samples.length,
      disconnectCount: summary.disconnectCount,
      disturbanceCount: summary.disturbanceCount
    };
  } catch (error) {
    logger.error('Keepalive probe failed', { reason: error.message, target });

    const summary = summarizeRunSamples(samples);
    await storage.completeRun(runId, {
      endedAt: new Date().toISOString(),
      verdict,
      disconnectCount: summary.disconnectCount,
      disturbanceCount: summary.disturbanceCount,
      notes: error.message
    });

    throw error;
  } finally {
    if (typeof adb.disconnect === 'function') {
      await adb.disconnect();
    }
  }
}

function createAdbProbeClient() {
  const client = Adb.createClient();
  let device = null;

  return {
    async connect(target) {
      await client.connect(target);
      device = client.getDevice(target);
      return device;
    },
    async sample({ command }) {
      const commandStream = await device.shell(command);
      await readAll(commandStream);

      const powerStream = await device.shell('dumpsys power');
      const powerOutput = await readAll(powerStream);

      let displayOutput = '';
      try {
        const displayStream = await device.shell('dumpsys display');
        displayOutput = await readAll(displayStream);
      } catch {
        displayOutput = '';
      }

      return {
        adbAlive: true,
        shellSuccess: true,
        powerOutput,
        displayOutput
      };
    },
    async disconnect() {
      device = null;
    }
  };
}

export { runKeepaliveProbe, createAdbProbeClient, computeProbeIterations };
