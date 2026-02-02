# ATV Super Controller

Android TV scheduler and controller - automate your Android TV over LAN via ADB TCP.

## Overview

A Node.js tool to schedule and control Android TV devices using ADB. Supports scheduling tasks (wake up, play video, etc.) via cron-like syntax.

## Features

- **Device Control**: Wake up, sleep, launch apps, play URLs.
- **Scheduling**: Schedule tasks using standard cron syntax.
- **Connection Management**: Robust ADB connection handling with auto-reconnect.
- **Monitoring**: Check device and task status.

## Installation

```bash
npm install
```

## Usage

```bash
# Start the scheduler service
node src/index.js start

# Check status
node src/index.js status

# Test connection
node src/index.js test

# Validate config
node src/index.js validate
```

## Project Structure

- `src/commands`: CLI command implementations
- `src/services`: Core logic (ADB, Scheduler)
- `src/actions`: Action strategies
- `src/utils`: Utilities (Logger, Config)

## License

MIT
