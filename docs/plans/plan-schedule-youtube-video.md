# Implementation Plan: Schedule YouTube Video at 7:00 AM

## Overview

**Goal:** Configure the ATV-Super-Controller to play `https://youtu.be/7huOSguPaUw` at 7:00 AM daily.

**Complexity:** Low - Configuration only, no code changes required.

## Analysis

### What Already Exists (Epic 1-4)

| Component | Status | Location |
|-----------|--------|----------|
| Scheduler Service | ✅ Complete | `src/services/scheduler.js` |
| Play-Video Action | ✅ Complete | `src/actions/play-video.js` |
| Wake Action | ✅ Complete | `src/actions/wake-up.js` |
| Config Validation | ✅ Complete | `src/utils/config.js` |
| CLI Commands | ✅ Complete | `src/commands/` |

### Current Configuration

The `config.json` already has:
- Device IP: `192.168.0.145:5555`
- YouTube client: SmartTube configured
- Existing tasks: `test-wake-task`, `test-youtube-task`

### URL Format

- Input: `https://youtu.be/7huOSguPaUw`
- Video ID: `7huOSguPaUw`
- The `play-video` action supports youtu.be short URLs directly.

## Implementation Steps

### Step 1: Add New Task to config.json

Add a new task named `morning-video-7am` with schedule `0 0 7 * * *` (7:00:00 AM daily).

**Task Configuration:**
```json
{
  "name": "morning-video-7am",
  "schedule": "0 0 7 * * *",
  "actions": [
    { "type": "wake" },
    { "type": "wait", "duration": 5000 },
    { "type": "play-video", "url": "https://youtu.be/7huOSguPaUw" }
  ]
}
```

**Cron Breakdown:** `0 0 7 * * *`
- `0` - Second 0
- `0` - Minute 0
- `7` - Hour 7 (7 AM)
- `*` - Every day of month
- `*` - Every month
- `*` - Every day of week

### Step 2: Validate Configuration

Run validation command to ensure config is correct:
```bash
npx atv-controller validate
```

### Step 3: Test Task Manually (Optional)

Test the task execution without waiting for schedule:
```bash
npx atv-controller test morning-video-7am
```

### Step 4: Start Scheduler Service

Start the scheduler to enable scheduled execution:
```bash
npx atv-controller start
```

### Step 5: Verify Task Registration

Check that the task is registered and shows correct next run time:
```bash
npx atv-controller status
```

## Verification Checklist

- [ ] Config validation passes
- [ ] Manual test plays the video on TV
- [ ] Scheduler starts without errors
- [ ] Status shows `morning-video-7am` with next run at 7:00 AM
- [ ] (Next day) Video plays automatically at 7:00 AM

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Device not reachable at 7 AM | Executor has retry logic (3 retries with exponential backoff) |
| TV in deep sleep | Wake action sends KEYCODE_POWER; 5s wait allows boot time |
| YouTube app not responding | SmartTube configured; VIEW intent is cross-app compatible |

## Rollback

To disable the task, either:
1. Remove the task from `config.json` and restart scheduler
2. Stop the scheduler service with `Ctrl+C`

## Notes

- The scheduler must be running for scheduled tasks to execute
- Consider running as a background service or using PM2 for persistence
- Execution history is tracked (last 10 runs per task)
