import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createProbeStorage,
  summarizeRunSamples
} from '../../src/services/probe-storage.js';

describe('probe-storage', () => {
  let dbPath;
  let storage;

  beforeEach(async () => {
    dbPath = join(tmpdir(), `probe-storage-${Date.now()}-${Math.random()}.sqlite`);
    storage = await createProbeStorage({ dbPath });
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }

    await rm(dbPath, { force: true });
  });

  it('creates a sqlite database file on initialization', async () => {
    await access(dbPath);
  });

  it('persists runs and samples and returns a normalized report', async () => {
    const runId = await storage.createRun({
      target: '192.168.1.100:5555',
      intervalMs: 30000,
      durationMs: 300000,
      command: 'echo ping'
    });

    await storage.appendSample(runId, {
      sampleIndex: 0,
      phase: 'baseline',
      adbAlive: true,
      shellSuccess: true,
      disturbanceDetected: false,
      interactive: false,
      wakefulness: 'Asleep',
      displayState: 'OFF',
      screenOnGuess: false,
      latencyMs: 101,
      errorMessage: null,
      powerOutput: 'mInteractive=false',
      displayOutput: 'state=OFF'
    });

    await storage.appendSample(runId, {
      sampleIndex: 1,
      phase: 'probe',
      adbAlive: false,
      shellSuccess: false,
      disturbanceDetected: false,
      interactive: false,
      wakefulness: 'Asleep',
      displayState: 'OFF',
      screenOnGuess: false,
      latencyMs: 5100,
      errorMessage: 'timeout',
      powerOutput: '',
      displayOutput: ''
    });

    await storage.completeRun(runId, {
      endedAt: '2026-03-09T10:00:00.000Z',
      verdict: 'ineffective_disconnect',
      disconnectCount: 1,
      disturbanceCount: 0,
      notes: 'ADB dropped once'
    });

    const report = await storage.getRunReport(runId);

    expect(report.run.id).toBe(runId);
    expect(report.run.verdict).toBe('ineffective_disconnect');
    expect(report.run.disconnectCount).toBe(1);
    expect(report.samples).toHaveLength(2);
    expect(report.samples[1].errorMessage).toBe('timeout');
  });

  it('lists runs in reverse chronological order', async () => {
    const firstRunId = await storage.createRun({
      target: '192.168.1.100:5555',
      intervalMs: 30000,
      durationMs: 60000,
      command: 'echo ping'
    });

    const secondRunId = await storage.createRun({
      target: '192.168.1.101:5555',
      intervalMs: 30000,
      durationMs: 60000,
      command: 'echo ping'
    });

    await storage.completeRun(firstRunId, {
      endedAt: '2026-03-09T10:00:00.000Z',
      verdict: 'effective',
      disconnectCount: 0,
      disturbanceCount: 0,
      notes: ''
    });

    await storage.completeRun(secondRunId, {
      endedAt: '2026-03-09T10:10:00.000Z',
      verdict: 'ineffective_both',
      disconnectCount: 1,
      disturbanceCount: 1,
      notes: ''
    });

    const runs = await storage.listRuns();

    expect(runs[0].id).toBe(secondRunId);
    expect(runs[1].id).toBe(firstRunId);
  });

  it('summarizes sample verdict counters', () => {
    const summary = summarizeRunSamples([
      { adbAlive: true, disturbanceDetected: false },
      { adbAlive: false, disturbanceDetected: false },
      { adbAlive: true, disturbanceDetected: true }
    ]);

    expect(summary.disconnectCount).toBe(1);
    expect(summary.disturbanceCount).toBe(1);
    expect(summary.verdict).toBe('ineffective_both');
  });

  it('returns effective with zero counts for empty samples array', () => {
    const result = summarizeRunSamples([]);
    expect(result).toEqual({ verdict: 'effective', disconnectCount: 0, disturbanceCount: 0 });
  });

  it('returns null for a runId that does not exist', async () => {
    const storage = await createProbeStorage({ dbPath: ':memory:' });
    const result = await storage.getRunReport(9999);
    expect(result).toBeNull();
    await storage.close();
  });
});
