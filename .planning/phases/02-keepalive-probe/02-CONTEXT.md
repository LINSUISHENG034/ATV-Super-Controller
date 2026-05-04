# Phase 2: Keepalive Probe - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate, test, and commit the already-written keepalive probe implementation. All core files exist but are uncommitted. The phase delivers: a working `probe-keepalive` CLI command, `probe-report` CLI command, SQLite persistence via sql.js, power state parsing, and a Docker compose `probe` profile — all verified by passing tests and committed to main.

</domain>

<decisions>
## Implementation Decisions

### Test Coverage
- **D-01:** Acceptance bar is "all probe tests pass + fill any missing scenarios." The 5 pre-existing failures (validate, web server, health-check) are Phase 1 issues — out of scope.
- **D-02:** All 18 probe tests currently pass (probe-storage, probe-keepalive service, probe-keepalive command, probe-report command, power-state-parser). No new test files needed unless gaps are found during planning.

### probe-report Output Format
- **D-03:** Keep current plain console.log line-by-line format. No table formatting, no `--json` flag needed.

### Docker Probe Profile
- **D-04:** Keep `atv-keepalive-probe` service as-is — `command: ["probe-keepalive"]` with no explicit args. Defaults (6h duration, 30s interval) come from code constants. Device target from `ATV_DEVICE_IP`/`ATV_DEVICE_PORT` env vars.

### Commit Strategy
- **D-05:** Single commit for all ~10 uncommitted probe files (services, commands, utils, tests, docker-compose changes, package.json, Dockerfile, README).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Keepalive Probe — PROBE-01 through PROBE-06 define the acceptance criteria
- `.planning/ROADMAP.md` §Phase 2 — success criteria (4 items)

### Existing Implementation (read before planning — code already exists)
- `src/commands/probe-keepalive.js` — CLI command handler
- `src/commands/probe-report.js` — report command handler
- `src/services/keepalive-probe.js` — core probe loop, ADB client
- `src/services/probe-storage.js` — sql.js SQLite persistence
- `src/utils/power-state-parser.js` — dumpsys output normalization
- `docker-compose.yml` — `atv-keepalive-probe` service with `probe` profile

### Tests (all passing)
- `tests/services/keepalive-probe.test.js`
- `tests/services/probe-storage.test.js`
- `tests/commands/probe-keepalive.test.js`
- `tests/commands/probe-report.test.js`
- `tests/utils/power-state-parser.test.js`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/config.js` `loadConfig()` — used by probe-keepalive command to read device IP/port
- `src/utils/logger.js` — winston logger, used throughout
- `@devicefarmer/adbkit` — `Adb.createClient()` + `device.shell()` pattern (validated in spike)

### Established Patterns
- ESM modules throughout (`import`/`export`) — no CommonJS
- Factory function pattern (`createProbeStorage`, `createAdbProbeClient`) — not classes
- Dependency injection via function params (`adb`, `storage`, `sleep`) — enables unit testing without mocks of real ADB
- sql.js: load from file → operate in memory → `db.export()` + `writeFile` to persist

### Integration Points
- `src/index.js` already registers both `probe-keepalive` and `probe-report` commands
- `docker-compose.yml` already has the `probe` profile service
- `probe-data/` volume mount already in compose and Dockerfile

</code_context>

<specifics>
## Specific Ideas

- The probe command defaults: `DEFAULT_INTERVAL_MS = 30000`, `DEFAULT_DURATION_MS = 21600000` (6h), `DEFAULT_COMMAND = 'echo ping'`, `DEFAULT_DB_PATH = '/app/probe-data/keepalive-probe.sqlite'`
- Verdict values: `effective`, `ineffective_disconnect`, `ineffective_screen_wake`, `ineffective_both`, `invalid_baseline`
- Disturbance detection: screen off → screen on transition between consecutive samples

</specifics>

<deferred>
## Deferred Ideas

- Multi-run comparison (v2 requirement in REQUIREMENTS.md)
- Web UI for probe results (v2 requirement)
- `--json` output flag for probe-report

</deferred>

---

*Phase: 2-Keepalive Probe*
*Context gathered: 2026-05-04*
