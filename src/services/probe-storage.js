import initSqlJs from 'sql.js';
import { createRequire } from 'module';
import { dirname } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

let sqlPromise = null;

function toIntegerBoolean(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

function fromIntegerBoolean(value) {
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
}

function summarizeRunSamples(samples) {
  const disconnectCount = samples.filter(sample => sample.adbAlive === false).length;
  const disturbanceCount = samples.filter(sample => sample.disturbanceDetected === true).length;

  let verdict = 'effective';
  if (disconnectCount > 0 && disturbanceCount > 0) {
    verdict = 'ineffective_both';
  } else if (disconnectCount > 0) {
    verdict = 'ineffective_disconnect';
  } else if (disturbanceCount > 0) {
    verdict = 'ineffective_screen_wake';
  }

  return {
    verdict,
    disconnectCount,
    disturbanceCount
  };
}

async function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => wasmPath
    });
  }

  return sqlPromise;
}

async function loadDatabase(dbPath) {
  const SQL = await getSql();

  try {
    const fileBuffer = await readFile(dbPath);
    return new SQL.Database(fileBuffer);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return new SQL.Database();
    }
    throw error;
  }
}

function runStatement(db, sql, params = []) {
  db.run(sql, params);
}

function queryAll(db, sql, params = []) {
  const statement = db.prepare(sql, params);
  const rows = [];

  while (statement.step()) {
    rows.push(statement.getAsObject());
  }

  statement.free();
  return rows;
}

function normalizeRun(row) {
  return {
    id: row.id,
    target: row.target,
    intervalMs: row.interval_ms,
    durationMs: row.duration_ms,
    command: row.command,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    verdict: row.verdict,
    disconnectCount: row.disconnect_count,
    disturbanceCount: row.disturbance_count,
    notes: row.notes
  };
}

function normalizeSample(row) {
  return {
    id: row.id,
    runId: row.run_id,
    sampleIndex: row.sample_index,
    phase: row.phase,
    adbAlive: fromIntegerBoolean(row.adb_alive),
    shellSuccess: fromIntegerBoolean(row.shell_success),
    disturbanceDetected: fromIntegerBoolean(row.disturbance_detected),
    interactive: fromIntegerBoolean(row.interactive),
    wakefulness: row.wakefulness,
    displayState: row.display_state,
    screenOnGuess: fromIntegerBoolean(row.screen_on_guess),
    latencyMs: row.latency_ms,
    errorMessage: row.error_message,
    powerOutput: row.power_output,
    displayOutput: row.display_output,
    sampledAt: row.sampled_at
  };
}

async function createProbeStorage({ dbPath }) {
  await mkdir(dirname(dbPath), { recursive: true });
  const db = await loadDatabase(dbPath);

  runStatement(db, `
    CREATE TABLE IF NOT EXISTS probe_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL,
      interval_ms INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      command TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      verdict TEXT,
      disconnect_count INTEGER DEFAULT 0,
      disturbance_count INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    )
  `);

  runStatement(db, `
    CREATE TABLE IF NOT EXISTS probe_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      sample_index INTEGER NOT NULL,
      phase TEXT NOT NULL,
      adb_alive INTEGER,
      shell_success INTEGER,
      disturbance_detected INTEGER,
      interactive INTEGER,
      wakefulness TEXT,
      display_state TEXT,
      screen_on_guess INTEGER,
      latency_ms INTEGER,
      error_message TEXT,
      power_output TEXT,
      display_output TEXT,
      sampled_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES probe_runs(id)
    )
  `);

  async function flush() {
    const data = db.export();
    await writeFile(dbPath, Buffer.from(data));
  }

  await flush();

  return {
    async createRun({ target, intervalMs, durationMs, command }) {
      const startedAt = new Date().toISOString();
      runStatement(
        db,
        `INSERT INTO probe_runs (target, interval_ms, duration_ms, command, started_at)
         VALUES (?, ?, ?, ?, ?)`,
        [target, intervalMs, durationMs, command, startedAt]
      );

      const row = queryAll(db, 'SELECT last_insert_rowid() AS id')[0];
      await flush();
      return row.id;
    },

    async appendSample(runId, sample) {
      runStatement(
        db,
        `INSERT INTO probe_samples (
          run_id, sample_index, phase, adb_alive, shell_success, disturbance_detected,
          interactive, wakefulness, display_state, screen_on_guess, latency_ms,
          error_message, power_output, display_output, sampled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          sample.sampleIndex,
          sample.phase,
          toIntegerBoolean(sample.adbAlive),
          toIntegerBoolean(sample.shellSuccess),
          toIntegerBoolean(sample.disturbanceDetected),
          toIntegerBoolean(sample.interactive),
          sample.wakefulness,
          sample.displayState,
          toIntegerBoolean(sample.screenOnGuess),
          sample.latencyMs,
          sample.errorMessage,
          sample.powerOutput,
          sample.displayOutput,
          sample.sampledAt || new Date().toISOString()
        ]
      );

      await flush();
    },

    async completeRun(runId, { endedAt, verdict, disconnectCount, disturbanceCount, notes }) {
      runStatement(
        db,
        `UPDATE probe_runs
         SET ended_at = ?, verdict = ?, disconnect_count = ?, disturbance_count = ?, notes = ?
         WHERE id = ?`,
        [endedAt, verdict, disconnectCount, disturbanceCount, notes || '', runId]
      );

      await flush();
    },

    async listRuns() {
      const rows = queryAll(
        db,
        `SELECT * FROM probe_runs
         ORDER BY COALESCE(ended_at, started_at) DESC, id DESC`
      );

      return rows.map(normalizeRun);
    },

    async getRunReport(runId) {
      const runRow = queryAll(db, 'SELECT * FROM probe_runs WHERE id = ?', [runId])[0];
      if (!runRow) {
        return null;
      }

      const sampleRows = queryAll(
        db,
        `SELECT * FROM probe_samples WHERE run_id = ? ORDER BY sample_index ASC, id ASC`,
        [runId]
      );

      return {
        run: normalizeRun(runRow),
        samples: sampleRows.map(normalizeSample)
      };
    },

    async close() {
      await flush();
      db.close();
    }
  };
}

export { createProbeStorage, summarizeRunSamples };
