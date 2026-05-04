---
name: ATV Super Controller
type: project
---

# ATV Super Controller

## What This Is

A Node.js CLI tool and Docker service for automating Android TV control over LAN via ADB TCP. Users configure scheduled tasks (cron-based) and control their TV remotely — wake/sleep, launch apps, play YouTube videos — through a CLI or browser-based Web UI.

## Core Value

Reliable, hands-free Android TV automation that survives network interruptions and container restarts without manual intervention.

## Context

- **Stack:** Node.js 18 ESM, Commander.js, @devicefarmer/adbkit, Express, node-schedule, sql.js, Vitest, Docker Compose
- **Runtime:** Docker container (primary), bare Node.js (secondary)
- **Target device:** Android TV over ADB TCP (LAN)
- **Current state:** Core scheduler + Web UI implemented. Keepalive probe feature partially implemented (files exist, not yet committed).

## Requirements

### Validated

- ✓ Device control (wake, sleep, launch app, play YouTube) — existing
- ✓ Cron-based task scheduling — existing
- ✓ Web UI dashboard with real-time status — existing
- ✓ Auto-reconnect on ADB disconnect — existing
- ✓ Docker support with health checks — existing
- ✓ Config validation — existing
- ✓ Timezone support for scheduled tasks — existing (commit 3386dfa)

### Active

- [ ] Keepalive probe — bounded experiment to verify ADB stays connected without waking screen
- [ ] Probe storage — SQLite-backed persistence for probe runs and samples
- [ ] Probe reporting — CLI command to print run reports from SQLite
- [ ] Power state parser — normalize vendor-specific dumpsys output
- [ ] Docker probe profile — dedicated compose service for probe experiments

### Out of Scope

- Remote control over internet (WAN) — security/complexity not warranted
- Multi-device management — single device per instance
- Mobile app — CLI + Web UI sufficient

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| @devicefarmer/adbkit over adb-kit | Original package removed from npm; devicefarmer is actively maintained | Validated in spike |
| device.shell() not client.shell() | New API uses device object pattern, not flat client | Validated in spike |
| VIEW intent over package name | Package/Activity names vary across devices and versions | Validated in spike |
| sql.js for probe storage | No native SQLite binding needed; runs in Docker without build deps | Active |
| Independent probe commands | Don't modify scheduler path; probe is an experiment tool | Active |
| ESM modules throughout | Node 18+, modern tooling | Existing |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-04 after initialization*
