import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/probe-storage.js', () => ({
  createProbeStorage: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('probe-report command', () => {
  let createProbeStorage;
  let probeReportCommand;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(async () => {
    vi.resetModules();

    ({ createProbeStorage } = await import('../../src/services/probe-storage.js'));
    ({ probeReportCommand } = await import('../../src/commands/probe-report.js'));

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('prints a report for an existing run', async () => {
    createProbeStorage.mockResolvedValue({
      getRunReport: vi.fn().mockResolvedValue({
        run: {
          id: 11,
          target: '192.168.1.100:5555',
          verdict: 'ineffective_disconnect',
          disconnectCount: 1,
          disturbanceCount: 0,
          startedAt: '2026-03-09T09:00:00.000Z',
          endedAt: '2026-03-09T10:00:00.000Z'
        },
        samples: [{}, {}]
      }),
      listRuns: vi.fn(),
      close: vi.fn()
    });

    const exitCode = await probeReportCommand({ runId: 11 });

    expect(exitCode).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Run ID: 11'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Samples: 2'));
  });

  it('returns exit code 1 when the requested run is missing', async () => {
    createProbeStorage.mockResolvedValue({
      getRunReport: vi.fn().mockResolvedValue(null),
      listRuns: vi.fn(),
      close: vi.fn()
    });

    const exitCode = await probeReportCommand({ runId: 999 });

    expect(exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('loads the latest run when no run id is supplied', async () => {
    const getRunReport = vi.fn().mockResolvedValue({
      run: {
        id: 12,
        target: '192.168.1.101:5555',
        verdict: 'effective',
        disconnectCount: 0,
        disturbanceCount: 0,
        startedAt: '2026-03-09T09:00:00.000Z',
        endedAt: '2026-03-09T10:00:00.000Z'
      },
      samples: [{}, {}, {}]
    });

    createProbeStorage.mockResolvedValue({
      getRunReport,
      listRuns: vi.fn().mockResolvedValue([{ id: 12 }]),
      close: vi.fn()
    });

    const exitCode = await probeReportCommand({});

    expect(exitCode).toBe(0);
    expect(getRunReport).toHaveBeenCalledWith(12);
  });
});
