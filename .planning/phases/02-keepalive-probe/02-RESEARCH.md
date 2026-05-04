# Phase 2: Keepalive Probe - Research

**Researched:** 2026-05-04
**Domain:** Validation and commit of existing Node.js/sql.js probe implementation
**Confidence:** HIGH

## Summary

Phase 2 is not a greenfield implementation — all source files already exist as uncommitted changes. The work is: run the probe test suite, confirm all 18 probe tests pass, verify the Docker compose `probe` profile is correctly wired, and commit everything in a single commit.

The test suite uses Vitest. The full suite currently shows 3 failing test files (validate, web server, health-check) and 5 failing tests — all pre-existing Phase 1 issues confirmed out of scope by D-01. The 27 passing test files include all 5 probe test files (18 probe tests pass). No new test files are needed unless a gap is found during planning.

The implementation is complete and internally consistent: ESM throughout, factory function pattern, dependency injection for testability, sql.js for SQLite (no native bindings), and a dedicated `probe` Docker compose profile that does not touch the scheduler service.

**Primary recommendation:** Run `npm test`, confirm probe tests pass, identify any coverage gaps, then commit all ~10 uncommitted probe files in a single commit.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLI entry points (probe-keepalive, probe-report) | CLI / commands layer | — | Commander.js already registers both in src/index.js |
| ADB sampling loop | Service layer (keepalive-probe.js) | — | Business logic isolated from CLI; injectable adb/storage/sleep |
| SQLite persistence | Service layer (probe-storage.js) | — | sql.js in-memory + flush pattern; no native binding |
| Power state normalization | Utility layer (power-state-parser.js) | — | Pure functions, no I/O, fully unit-testable |
| Docker isolation | Compose profile (`probe`) | — | `atv-keepalive-probe` service with `profiles: [probe]` keeps scheduler untouched |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Acceptance bar is "all probe tests pass + fill any missing scenarios." The 5 pre-existing failures (validate, web server, health-check) are Phase 1 issues — out of scope.
- **D-02:** All 18 probe tests currently pass. No new test files needed unless gaps are found during planning.
- **D-03:** Keep current plain console.log line-by-line format for probe-report. No table formatting, no `--json` flag.
- **D-04:** Keep `atv-keepalive-probe` service as-is — `command: ["probe-keepalive"]` with no explicit args. Defaults (6h duration, 30s interval) come from code constants. Device target from env vars.
- **D-05:** Single commit for all ~10 uncommitted probe files (services, commands, utils, tests, docker-compose changes, package.json, Dockerfile, README).

### Claude's Discretion
None specified.

### Deferred Ideas (OUT OF SCOPE)
- Multi-run comparison (v2 requirement)
- Web UI for probe results (v2 requirement)
- `--json` output flag for probe-report
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROBE-01 | User can run a bounded keepalive experiment via CLI | `probe-keepalive` command exists in src/commands/probe-keepalive.js; registered in src/index.js |
| PROBE-02 | Probe samples ADB connectivity and power state at configurable intervals | runKeepaliveProbe loop in keepalive-probe.js; interval/duration params injectable |
| PROBE-03 | Probe persists run and sample data to SQLite | probe-storage.js uses sql.js; createRun/appendSample/completeRun/flush pattern |
| PROBE-04 | User can print a run report from SQLite via CLI | probe-report command exists; lists runs, fetches by runId, prints plain console.log lines |
| PROBE-05 | Power state parser normalizes vendor-specific dumpsys output | power-state-parser.js: parsePowerState + detectScreenDisturbance pure functions |
| PROBE-06 | Probe runs in Docker via dedicated compose profile without modifying scheduler | docker-compose.yml has `atv-keepalive-probe` service under `profiles: [probe]` |
</phase_requirements>

## Standard Stack

### Core (already installed — verified in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner | Already in devDependencies; all probe tests use it |
| sql.js | ^1.14.1 | SQLite via WebAssembly | No native build deps; works in Alpine Docker without node-gyp |
| @devicefarmer/adbkit | ^3.3.8 | ADB client | Validated in spike; device.shell() pattern confirmed |
| commander | ^14.0.3 | CLI parsing | Already used for all commands |

[VERIFIED: package.json in repo]

No new dependencies required for this phase.

## Architecture Patterns

### Existing Project Structure (relevant to probe)

```
src/
├── commands/
│   ├── probe-keepalive.js   # CLI handler — loads config, wires storage+adb, calls service
│   └── probe-report.js      # CLI handler — loads storage, prints run report
├── services/
│   ├── keepalive-probe.js   # Core loop: baseline + N probe iterations, verdict computation
│   └── probe-storage.js     # sql.js factory: createRun/appendSample/completeRun/listRuns/getRunReport
└── utils/
    └── power-state-parser.js  # Pure: parsePowerState, detectScreenDisturbance
tests/
├── commands/
│   ├── probe-keepalive.test.js
│   └── probe-report.test.js
├── services/
│   ├── keepalive-probe.test.js
│   └── probe-storage.test.js
└── utils/
    └── power-state-parser.test.js
probe-data/                  # Volume mount target for SQLite output
```

### Pattern: Factory Function with Dependency Injection

All probe services use factory functions, not classes. Dependencies (adb, storage, sleep) are injected as parameters, enabling unit tests without real ADB or filesystem.

```javascript
// Source: src/services/keepalive-probe.js
export async function runKeepaliveProbe({ target, intervalMs, durationMs, command, adb, storage, sleep = defaultSleep }) { ... }
```

### Pattern: sql.js In-Memory + Flush

sql.js operates entirely in memory. Every mutating operation calls `flush()` which exports the DB buffer and writes it to disk.

```javascript
// Source: src/services/probe-storage.js
async function flush() {
  const data = db.export();
  await writeFile(dbPath, Buffer.from(data));
}
```

### Pattern: Verdict Computation

Verdict is derived from sample aggregation, not set incrementally:

| Condition | Verdict |
|-----------|---------|
| No disconnects, no disturbances | `effective` |
| Disconnects only | `ineffective_disconnect` |
| Disturbances only | `ineffective_screen_wake` |
| Both | `ineffective_both` |
| Baseline failure | `invalid_baseline` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite persistence | Custom file format | sql.js (already in use) | WASM-based, no native deps, Alpine-compatible |
| ADB shell execution | Raw TCP | @devicefarmer/adbkit (already in use) | Handles protocol, reconnect, stream reading |
| Test mocking | Custom spy system | vitest vi.fn() / vi.mock() (already in use) | Already used in all 5 probe test files |

## Common Pitfalls

### Pitfall 1: sql.js WASM Path Resolution
**What goes wrong:** `initSqlJs` fails to locate `sql-wasm.wasm` at runtime in Docker.
**Why it happens:** WASM file must be resolved from `node_modules` at runtime; path differs between dev and container.
**How to avoid:** The existing code uses `require.resolve('sql.js/dist/sql-wasm.wasm')` via `createRequire(import.meta.url)` — this is already correct. Do not change this pattern.
**Warning signs:** `Error: ENOENT: no such file or directory, open '...sql-wasm.wasm'` at startup.

### Pitfall 2: ESM + vi.mock() Hoisting
**What goes wrong:** `vi.mock()` calls must appear at the top of test files before imports; dynamic re-import pattern (`vi.resetModules()` + `await import(...)` in `beforeEach`) is required for mocks to take effect per test.
**Why it happens:** ESM static imports are hoisted; mocks must be declared before module evaluation.
**How to avoid:** Already handled correctly in probe-keepalive.test.js and probe-report.test.js. Do not refactor to static imports.

### Pitfall 3: Pre-existing Test Failures Are Out of Scope
**What goes wrong:** Running `npm test` shows 5 failures — these are Phase 1 issues (validate command, web server, health-check).
**Why it happens:** Phase 1 issues unrelated to probe implementation.
**How to avoid:** Per D-01, only probe test results matter. Confirm 18 probe tests pass; ignore the 5 pre-existing failures.
**Warning signs:** Failing files are `tests/commands/validate.test.js`, `tests/web/server.test.js`, `tests/utils/health-check.test.js`.

### Pitfall 4: probe-data Directory Must Exist Before Docker Run
**What goes wrong:** `probe-data/` volume mount fails or SQLite write fails if host directory doesn't exist.
**Why it happens:** Docker bind mount creates the directory as root if it doesn't exist, causing permission errors for `atvuser` (UID 1001).
**How to avoid:** `mkdir -p probe-data` on the host before running the probe profile. The Dockerfile already creates `/app/probe-data` with correct ownership inside the image.

## Test Coverage Assessment

### Current Probe Test Count: 18 tests across 5 files

| File | Tests | Coverage |
|------|-------|---------|
| probe-storage.test.js | 4 | createRun, appendSample, completeRun, listRuns ordering, summarizeRunSamples |
| keepalive-probe.test.js | 3 | baseline phase, disturbance detection, disconnect detection, iteration count |
| probe-keepalive.test.js | 2 | default options wiring, summary output |
| probe-report.test.js | 3 | existing run, missing run, latest run fallback |
| power-state-parser.test.js | 5 | interactive/wakefulness parsing, display fallback, unknown fields, disturbance detection, no-disturbance |

[VERIFIED: read all 5 test files]

### Potential Gap to Verify During Planning

- `getRunReport` returning `null` for missing run is tested in probe-report.test.js (via mock). The storage-level behavior (returning null when runId not found) is implicitly covered by the mock but not by a direct probe-storage integration test. Low risk — the SQL query is trivial — but worth noting.
- `summarizeRunSamples` with zero samples (empty array) is not explicitly tested. The function returns `effective` with zero counts, which is correct behavior but untested.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner, CLI | Yes | >=18 (engines field) | — |
| npm | Package install | Yes | — | — |
| vitest | Test execution | Yes | ^4.0.18 (devDependencies) | — |
| sql.js WASM | probe-storage.js | Yes | ^1.14.1 (dependencies) | — |
| Docker | PROBE-06 verification | Not verified in this env | — | Manual compose inspection |

[VERIFIED: package.json; Docker availability not probed — not needed for test/commit tasks]

## Uncommitted Files Inventory

All files to be included in the single commit (D-05):

**New source files:**
- `src/commands/probe-keepalive.js`
- `src/commands/probe-report.js`
- `src/services/keepalive-probe.js`
- `src/services/probe-storage.js`
- `src/utils/power-state-parser.js`

**New test files:**
- `tests/commands/probe-keepalive.test.js`
- `tests/commands/probe-report.test.js`
- `tests/services/keepalive-probe.test.js`
- `tests/services/probe-storage.test.js`
- `tests/utils/power-state-parser.test.js`

**Modified files:**
- `src/index.js` — registers probe-keepalive and probe-report commands
- `docker-compose.yml` — adds `atv-keepalive-probe` service with `probe` profile
- `Dockerfile` — creates `/app/probe-data` directory with correct ownership
- `package.json` — adds sql.js dependency
- `package-lock.json` — lockfile update
- `README.md` — documentation updates (git status shows M)

[VERIFIED: git status output from conversation context]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All 18 probe tests currently pass (D-02 states this) | Test Coverage | If any probe test fails, a fix task must be added to the plan before the commit task |
| A2 | README.md changes are probe-related documentation | Uncommitted Files | If README changes are unrelated to probe, they should still be included per D-05 scope |

## Open Questions

1. **Coverage gaps: are they worth filling?**
   - What we know: `summarizeRunSamples([])` and `getRunReport` null path are not directly integration-tested
   - What's unclear: Whether the planner should add a task to fill these gaps or accept current coverage
   - Recommendation: Per D-02, no new test files needed unless gaps are found. These are minor — planner should decide based on risk tolerance.

## Sources

### Primary (HIGH confidence)
- `src/commands/probe-keepalive.js` — read directly
- `src/commands/probe-report.js` — read directly
- `src/services/keepalive-probe.js` — read directly
- `src/services/probe-storage.js` — read directly
- `src/utils/power-state-parser.js` — read directly
- All 5 test files — read directly
- `package.json` — verified dependency versions
- `docker-compose.yml` — verified probe profile
- `Dockerfile` — verified probe-data directory setup
- `.planning/phases/02-keepalive-probe/02-CONTEXT.md` — locked decisions
- `.planning/config.json` — nyquist_validation: false confirmed

## Metadata

**Confidence breakdown:**
- Implementation state: HIGH — all files read directly
- Test pass/fail state: HIGH — npm test output observed (18 probe tests pass, 5 pre-existing failures out of scope)
- Docker profile correctness: HIGH — docker-compose.yml read directly
- Coverage gaps: MEDIUM — identified by reading tests, not by running coverage tooling

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable implementation, no moving dependencies)
