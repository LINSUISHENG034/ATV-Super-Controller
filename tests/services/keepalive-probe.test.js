import { describe, it, expect, vi } from 'vitest';
import { runKeepaliveProbe } from '../../src/services/keepalive-probe.js';

function createMemoryStorage() {
  const runs = [];
  const samples = [];

  return {
    runs,
    samples,
    async createRun(payload) {
      const run = { id: runs.length + 1, ...payload };
      runs.push(run);
      return run.id;
    },
    async appendSample(runId, sample) {
      samples.push({ runId, ...sample });
    },
    async completeRun(runId, summary) {
      const run = runs.find(entry => entry.id === runId);
      Object.assign(run, summary);
    }
  };
}

function createFakeAdb(sequence) {
  let index = 0;

  return {
    async connect(target) {
      return { target };
    },
    async disconnect() {},
    async sample() {
      const current = sequence[index] ?? sequence[sequence.length - 1];
      index += 1;
      if (current.error) {
        throw current.error;
      }
      return current;
    }
  };
}

describe('keepalive-probe service', () => {
  it('creates a baseline sample before probe iterations', async () => {
    const storage = createMemoryStorage();
    const adb = createFakeAdb([
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=false\nmWakefulness=Asleep\nDisplay Power: state=OFF',
        displayOutput: ''
      },
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=false\nmWakefulness=Asleep\nDisplay Power: state=OFF',
        displayOutput: ''
      }
    ]);

    const result = await runKeepaliveProbe({
      target: '192.168.1.100:5555',
      intervalMs: 1000,
      durationMs: 1000,
      command: 'echo ping',
      adb,
      storage,
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    expect(result.runId).toBe(1);
    expect(storage.samples).toHaveLength(2);
    expect(storage.samples[0].phase).toBe('baseline');
    expect(storage.samples[1].phase).toBe('probe');
  });

  it('classifies screen disturbance when a later sample wakes the display', async () => {
    const storage = createMemoryStorage();
    const adb = createFakeAdb([
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=false\nmWakefulness=Asleep\nDisplay Power: state=OFF',
        displayOutput: ''
      },
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=true\nmWakefulness=Awake\nDisplay Power: state=ON',
        displayOutput: ''
      }
    ]);

    const result = await runKeepaliveProbe({
      target: '192.168.1.100:5555',
      intervalMs: 1000,
      durationMs: 1000,
      command: 'echo ping',
      adb,
      storage,
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    expect(result.verdict).toBe('ineffective_screen_wake');
    expect(storage.samples[1].disturbanceDetected).toBe(true);
  });

  it('classifies disconnect when probe sampling loses adb connectivity', async () => {
    const storage = createMemoryStorage();
    const adb = createFakeAdb([
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=false\nmWakefulness=Asleep\nDisplay Power: state=OFF',
        displayOutput: ''
      },
      {
        error: new Error('shell timeout')
      }
    ]);

    const result = await runKeepaliveProbe({
      target: '192.168.1.100:5555',
      intervalMs: 1000,
      durationMs: 1000,
      command: 'echo ping',
      adb,
      storage,
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    expect(result.verdict).toBe('ineffective_disconnect');
    expect(storage.samples[1].adbAlive).toBe(false);
    expect(storage.samples[1].errorMessage).toBe('shell timeout');
  });

  it('runs a bounded number of probe iterations from duration and interval', async () => {
    const storage = createMemoryStorage();
    const adb = createFakeAdb([
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=false\nmWakefulness=Asleep\nDisplay Power: state=OFF',
        displayOutput: ''
      },
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=false\nmWakefulness=Asleep\nDisplay Power: state=OFF',
        displayOutput: ''
      },
      {
        adbAlive: true,
        shellSuccess: true,
        powerOutput: 'mInteractive=false\nmWakefulness=Asleep\nDisplay Power: state=OFF',
        displayOutput: ''
      }
    ]);

    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await runKeepaliveProbe({
      target: '192.168.1.100:5555',
      intervalMs: 1000,
      durationMs: 2000,
      command: 'echo ping',
      adb,
      storage,
      sleep
    });

    expect(result.sampleCount).toBe(3);
    expect(storage.samples).toHaveLength(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
