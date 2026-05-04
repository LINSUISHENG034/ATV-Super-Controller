# Roadmap — ATV Super Controller

## Phases

- [x] **Phase 1: Core Platform** - Device control, scheduling, Web UI, and Docker infrastructure
- [ ] **Phase 2: Keepalive Probe** - Bounded ADB connectivity experiment with SQLite persistence and CLI reporting

## Phase Details

### Phase 1: Core Platform
**Goal**: Users can control their Android TV, schedule automated tasks, and monitor status via browser
**Depends on**: Nothing
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04, SCHED-01, SCHED-02, SCHED-03, UI-01, UI-02, UI-03, INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. User can wake, sleep, launch apps, and play YouTube via CLI commands
  2. Scheduler executes cron tasks at correct local time and auto-reconnects after ADB disconnect
  3. User can view device status, trigger actions, and manage tasks from browser dashboard
  4. Service runs in Docker with health checks and does not restart-loop when TV is unreachable
**Plans**: Complete
**Status**: Done

### Phase 2: Keepalive Probe
**Goal**: Users can run a bounded ADB keepalive experiment, persist results to SQLite, and read reports via CLI
**Depends on**: Phase 1
**Requirements**: PROBE-01, PROBE-02, PROBE-03, PROBE-04, PROBE-05, PROBE-06
**Success Criteria** (what must be TRUE):
  1. User can start a time-bounded probe run via `probe-keepalive` CLI command with configurable interval
  2. Probe samples ADB connectivity and normalized power state at each interval and stores results in SQLite
  3. User can print a formatted run report from SQLite via `probe-report` CLI command
  4. Probe runs in Docker via a dedicated compose profile without touching the scheduler service
**Plans**: 2 plans
Plans:
- [ ] 02-01-PLAN.md — Verify probe test suite passes and fill coverage gaps
- [ ] 02-02-PLAN.md — Stage and commit all probe files, push to origin/main
**UI hint**: no

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Platform | - | Done | 2026-05-04 |
| 2. Keepalive Probe | 0/2 | Not started | - |
