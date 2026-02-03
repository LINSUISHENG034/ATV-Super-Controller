# Android TV Device Testing Learnings

**Date:** 2026-02-03
**Device:** Xiaomi Android TV (192.168.0.145:5555)

## Key Findings

### 1. KEYCODE_WAKEUP Not Universally Supported

**Problem:** `KEYCODE_WAKEUP` (224) does not wake some Android TV devices from sleep.

**Symptoms:**

- `input keyevent KEYCODE_WAKEUP` executes without error
- `dumpsys power | grep mWakefulness=` still shows `Asleep`
- Screen remains black

**Solution:** Use `KEYCODE_POWER` (26) instead:

```bash
input keyevent KEYCODE_POWER
```

**Verification:** Always verify wake state after command:

```bash
dumpsys power | grep mWakefulness=
# Expected: mWakefulness=Awake
```

**Important:** `KEYCODE_POWER` is a toggle - if device is already awake, it will sleep. Always check `mWakefulness` first.

---

### 2. VIEW Intent Requires Registered URL Handler

**Problem:** Generic VIEW intent fails when no app is registered to handle YouTube URLs.

**Symptoms:**

- `am start -a android.intent.action.VIEW -d "https://youtube.com/..."` fails
- System shows "No app found to handle this content" dialog
- SmartTube installed but not registered as default YouTube URL handler

**Root Cause:**

- Official YouTube TV (`com.google.android.youtube.tv`) is not installed
- SmartTube (`com.teamsmart.videomanager.tv`) is installed but not registered for `youtube.com` URLs

**Solution:** Explicitly specify package and activity:

```bash
am start -a android.intent.action.VIEW \
  -d "https://www.youtube.com/watch?v=VIDEO_ID" \
  -n com.teamsmart.videomanager.tv/com.liskovsoft.smartyoutubetv2.tv.ui.main.SplashActivity
```

---

### 3. SmartTube Package Structure

**Package name:** `com.teamsmart.videomanager.tv`
**Activity:** `com.liskovsoft.smartyoutubetv2.tv.ui.main.SplashActivity`

Note: Package name differs from Activity namespace due to app rebranding.

**Discovery command:**

```bash
dumpsys package com.teamsmart.videomanager.tv | grep -E 'Activity|VIEW'
```

---

### 4. Known YouTube TV Package Names

```javascript
const YOUTUBE_PACKAGES = [
  // Official YouTube
  { package: "com.google.android.youtube.tv", activity: null }, // auto-discover

  // SmartTube (popular third-party)
  {
    package: "com.teamsmart.videomanager.tv",
    activity: "com.liskovsoft.smartyoutubetv2.tv.ui.main.SplashActivity",
  },

  // SmartTube alternative package
  {
    package: "com.liskovsoft.smartyoutubetv2.tv",
    activity: "com.liskovsoft.smartyoutubetv2.tv.ui.main.SplashActivity",
  },
];
```

---

## Recommended Architecture for Multi-Client Support

### Config-based YouTube Client

Add to `config.json`:

```json
{
  "device": { "ip": "...", "port": 5555 },
  "youtube": {
    "package": "com.teamsmart.videomanager.tv",
    "activity": "com.liskovsoft.smartyoutubetv2.tv.ui.main.SplashActivity"
  }
}
```

### Fallback Strategy

1. If `config.youtube` specified → use explicit package/activity
2. Else → attempt VIEW intent (works for official YouTube)
3. If fails → return error with suggestion to configure youtube client

---

## ADB Connection Notes

- ADB TCP connections are not persistent between commands
- Must `adb connect` before each session
- App's adbkit maintains persistent connection via `client.connect(ip, port)`

---

## Device-Specific Notes (Xiaomi Android TV)

- Uses `com.mitv.tvhome` as launcher
- Has custom settings at `com.xiaomi.mitv.settings`
- Power management responds to `KEYCODE_POWER` but not `KEYCODE_WAKEUP`
