# Requirements — ATV Super Controller

## v1 Requirements

### Device Control
- [x] **CTRL-01**: User can wake up the Android TV via ADB command
- [x] **CTRL-02**: User can put the Android TV to sleep via ADB command
- [x] **CTRL-03**: User can launch an app by package name
- [x] **CTRL-04**: User can play a YouTube video by URL

### Scheduling
- [x] **SCHED-01**: User can define cron-based scheduled tasks in config file
- [x] **SCHED-02**: Scheduler executes tasks at correct local time (timezone-aware)
- [x] **SCHED-03**: Scheduler auto-reconnects after ADB disconnect

### Web UI
- [x] **UI-01**: User can view device status in browser dashboard
- [x] **UI-02**: User can trigger quick actions from browser
- [x] **UI-03**: User can manage scheduled tasks from browser

### Infrastructure
- [x] **INFRA-01**: Service runs in Docker container with health checks
- [x] **INFRA-02**: Config file is validated on startup
- [x] **INFRA-03**: Container does not restart-loop when device is unavailable

### Keepalive Probe (Active)
- [ ] **PROBE-01**: User can run a bounded keepalive experiment via CLI
- [ ] **PROBE-02**: Probe samples ADB connectivity and power state at configurable intervals
- [ ] **PROBE-03**: Probe persists run and sample data to SQLite
- [ ] **PROBE-04**: User can print a run report from SQLite via CLI
- [ ] **PROBE-05**: Power state parser normalizes vendor-specific dumpsys output
- [ ] **PROBE-06**: Probe runs in Docker via dedicated compose profile without modifying scheduler

## v2 Requirements

- Multi-device support (one instance per device is current workaround)
- Probe comparison across multiple runs
- Web UI for probe results

## Out of Scope

- WAN/internet remote control — security complexity not warranted for home use
- Mobile app — CLI + Web UI covers the use case
- Native SQLite binding — sql.js avoids build dependencies in Docker

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CTRL-01 to CTRL-04 | Phase 1 | Done |
| SCHED-01 to SCHED-03 | Phase 1 | Done |
| UI-01 to UI-03 | Phase 1 | Done |
| INFRA-01 to INFRA-03 | Phase 1 | Done |
| PROBE-01 to PROBE-06 | Phase 2 | Pending |
