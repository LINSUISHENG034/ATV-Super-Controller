import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn()
}));

vi.mock('../../src/services/probe-storage.js', () => ({
  createProbeStorage: vi.fn()
}));

vi.mock('../../src/services/keepalive-probe.js', () => ({
  createAdbProbeClient: vi.fn(),
  runKeepaliveProbe: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('probe-keepalive command', () => {
  let loadConfig;
  let createProbeStorage;
  let createAdbProbeClient;
  let runKeepaliveProbe;
  let probeKeepaliveCommand;
  let consoleSpy;

  beforeEach(async () => {
    vi.resetModules();

    ({ loadConfig } = await import('../../src/utils/config.js'));
    ({ createProbeStorage } = await import('../../src/services/probe-storage.js'));
    ({ createAdbProbeClient, runKeepaliveProbe } = await import('../../src/services/keepalive-probe.js'));
    ({ probeKeepaliveCommand } = await import('../../src/commands/probe-keepalive.js'));

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    loadConfig.mockResolvedValue({
      device: { ip: '192.168.1.100', port: 5555 }
    });
    createProbeStorage.mockResolvedValue({ close: vi.fn() });
    createAdbProbeClient.mockReturnValue({});
    runKeepaliveProbe.mockResolvedValue({
      runId: 7,
      verdict: 'effective',
      sampleCount: 3,
      disconnectCount: 0,
      disturbanceCount: 0
    });
  });

  it('uses config target and command defaults when options are omitted', async () => {
    await probeKeepaliveCommand({});

    expect(createProbeStorage).toHaveBeenCalledWith(
      expect.objectContaining({ dbPath: expect.stringContaining('probe-data') })
    );
    expect(runKeepaliveProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        target: '192.168.1.100:5555',
        intervalMs: 30000,
        durationMs: 21600000,
        command: 'echo ping'
      })
    );
  });

  it('prints a summary with run id and verdict', async () => {
    const exitCode = await probeKeepaliveCommand({ durationMs: 60000, intervalMs: 30000 });

    expect(exitCode).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Run ID: 7'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Verdict: effective'));
  });
});
