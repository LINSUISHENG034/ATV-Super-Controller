import { createProbeStorage } from '../services/probe-storage.js';

const DEFAULT_DB_PATH = '/app/probe-data/keepalive-probe.sqlite';

export async function probeReportCommand(options = {}) {
  const dbPath = options.dbPath || DEFAULT_DB_PATH;
  const storage = await createProbeStorage({ dbPath });

  try {
    let runId = options.runId;

    if (!runId) {
      const runs = await storage.listRuns();
      if (!runs.length) {
        console.error('No probe runs found');
        return 1;
      }
      runId = runs[0].id;
    }

    const report = await storage.getRunReport(runId);
    if (!report) {
      console.error(`Probe run not found: ${runId}`);
      return 1;
    }

    console.log(`Run ID: ${report.run.id}`);
    console.log(`Target: ${report.run.target}`);
    console.log(`Verdict: ${report.run.verdict}`);
    console.log(`Disconnects: ${report.run.disconnectCount}`);
    console.log(`Screen Disturbances: ${report.run.disturbanceCount}`);
    console.log(`Started: ${report.run.startedAt}`);
    console.log(`Ended: ${report.run.endedAt}`);
    console.log(`Samples: ${report.samples.length}`);

    return 0;
  } finally {
    await storage.close();
  }
}
