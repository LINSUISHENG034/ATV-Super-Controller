# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATV-Scheduler-CLI is a Node.js command-line tool for automating Android TV control over LAN via ADB TCP. The primary use case is scheduling wake-up and YouTube playback at specified times (e.g., morning news at 7:30 AM), but it supports arbitrary shell commands and intents via configuration.

**Current Status:** Technical spike completed. Core implementation pending.

## Technical Stack

- **Runtime:** Node.js 18+ with ES Modules (`"type": "module"`)
- **ADB Library:** `@devicefarmer/adbkit` (NOT `adb-kit` - the original package is deprecated)
- **Scheduling:** `node-schedule` (planned)
- **Logging:** `winston` (planned)
- **Deployment:** Docker (planned)

## Critical Technical Notes

### adb-kit Import Pattern

The `@devicefarmer/adbkit` module has a specific structure that differs from documentation:

```javascript
// CORRECT
import AdbKit from '@devicefarmer/adbkit';
const Adb = AdbKit.Adb;
const client = Adb.createClient();

// WRONG - will fail
import Adb from '@devicefarmer/adbkit';
const client = Adb.createClient();
```

### Device API Pattern

Shell commands use a two-step device object pattern:

```javascript
// CORRECT
const device = client.getDevice('192.168.0.145:5555');
const stream = await device.shell('echo hello');

// WRONG - shell() is not on client
await client.shell('192.168.0.145:5555', 'echo hello');
```

### YouTube Launch Method

Use VIEW intent for reliability across devices (avoids hardcoding Activity names):

```bash
am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=VIDEO_ID"
```

## Commands

### Spike Tests (validation)

```bash
cd spike
npm install
npm run test:install    # Verify adb-kit works
npm run test:connect    # Test ADB TCP connection
npm run test:shell      # Test shell command execution
npm run test:youtube    # Test YouTube TV launch
npm run test:all        # Run all tests in sequence
```

Configure device IP in `spike/config.mjs` before running.

## Project Structure

```
spike/                   # Technical validation (pre-implementation)
  ├── config.mjs         # Device IP/port configuration
  ├── 01-test-*.mjs      # Numbered test scripts (run in order)
  └── CHECKLIST.md       # Spike validation checklist

docs/
  ├── init-prd.md        # Product requirements (Chinese)
  ├── specification/     # Technical specifications
  └── memory/            # Development notes and lessons learned
```

## Git Workflow

- **Branches:** `main`, `develop`, `feature/*`, `fix/*`, `docs/*`, `refactor/*`, `test/*`
- **Commit format:** `<type>(<scope>): <subject>` (e.g., `feat(scheduler): add cron parsing`)
- **Types:** feat, fix, docs, style, refactor, test, chore
- Never mention AI tools in commit messages

## Configuration File Design (Planned)

```json
{
  "device": { "ip": "192.168.x.x", "port": 5555 },
  "tasks": [
    {
      "name": "Morning News",
      "cron": "0 30 7 * * *",
      "actions": [
        { "type": "wake_up" },
        { "type": "wait", "ms": 5000 },
        { "type": "launch_app", "package": "...", "data_uri": "..." }
      ]
    }
  ]
}
```
