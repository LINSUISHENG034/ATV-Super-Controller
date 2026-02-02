# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATV-Super-Controller is a Node.js CLI tool for automating Android TV control over LAN via ADB TCP.

**Current Status:** Technical spike completed. Core implementation pending.

## Documentation (Single Source of Truth)

| Document | Purpose |
|----------|---------|
| [`_bmad-output/project-context.md`](_bmad-output/project-context.md) | **AI Agent Rules** - Critical implementation patterns |
| [`_bmad-output/planning-artifacts/architecture.md`](_bmad-output/planning-artifacts/architecture.md) | Architecture decisions & project structure |
| [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md) | Product requirements (19 FRs, 8 NFRs) |
| [`docs/memory/2026-02-01.md`](docs/memory/2026-02-01.md) | Technical spike lessons learned |

**IMPORTANT:** Always read `project-context.md` before implementing code.

## Quick Reference

### Critical ADB Patterns (from project-context.md)

```javascript
// Import pattern - MUST use nested structure
import AdbKit from '@devicefarmer/adbkit';
const Adb = AdbKit.Adb;

// Device API - shell() is on device, NOT client
const device = client.getDevice('ip:port');
await device.shell('command');
```

### Spike Tests

```bash
cd spike
npm install
npm run test:all    # Run all validation tests
```

Configure device IP in `spike/config.mjs` before running.

## Project Structure

See [`architecture.md`](_bmad-output/planning-artifacts/architecture.md) for complete structure.

```
src/
├── commands/     # CLI command handlers
├── services/     # Core business logic
├── actions/      # Strategy pattern implementations
└── utils/        # Config, logger, errors
```

## Git Workflow

See [`docs/specification/git-workflow.md`](docs/specification/git-workflow.md) for details.

- **Commit format:** `<type>(<scope>): <subject>`
- **Types:** feat, fix, docs, style, refactor, test, chore
- Never mention AI tools in commit messages

## Configuration Schema

See [`architecture.md`](_bmad-output/planning-artifacts/architecture.md) for full schema.

Environment variables: `ATV_DEVICE_IP`, `ATV_DEVICE_PORT`, `ATV_LOG_LEVEL`, `ATV_CONFIG_PATH`
