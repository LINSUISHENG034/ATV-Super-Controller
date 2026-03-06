# Implementation Plan: APK Sideloading & App Manager

## Overview

Add a Web-based APK sideloading and app management feature to ATV-Super-Controller. This enables drag-and-drop APK installation, app lifecycle management, and integration with existing scheduler/HA systems.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File Upload | `multer` middleware | Standard Express file handling, memory-efficient streaming |
| APK Storage | Temp directory | Clean up after install, no persistent storage needed |
| App List Source | `pm list packages -f -3` | Lists third-party apps with paths |
| App Info Source | `dumpsys package <pkg>` | Detailed app metadata |

## Implementation Steps

### Step 1: Backend - App List Service

Create `src/services/app-manager.js` to handle app queries via ADB.

**Functions:**
- `listInstalledApps()` - Get all third-party apps with size/version
- `getAppInfo(packageName)` - Get detailed app info

**ADB Commands:**
```bash
pm list packages -f -3              # List third-party packages
dumpsys package <pkg> | grep -E "versionName|firstInstallTime"
du -s /data/app/<pkg>*              # Get app size
```

**Acceptance Criteria:**
- Returns array of `{ package, name, version, size, path }`
- Handles device disconnection gracefully

---

### Step 2: Backend - App Control Actions

Create new action modules following existing Strategy pattern.

**New Actions:**
1. `src/actions/install-app.js` - Install APK via `adb install -r`
2. `src/actions/uninstall-app.js` - Uninstall via `pm uninstall`
3. `src/actions/force-stop.js` - Stop app via `am force-stop`
4. `src/actions/clear-cache.js` - Clear cache via `pm clear`

**Action Interface (existing pattern):**
```javascript
{
  name: 'force-stop',
  async execute(device, params) {
    // params: { package: string }
    return successResult(...) | errorResult(...)
  }
}
```

**Register in `src/actions/index.js`**

---

### Step 3: Backend - File Upload Endpoint

Add APK upload handling to `src/web/routes/api.js`.

**New Endpoints:**
```
POST /api/v1/apps/install     - Upload and install APK (multipart/form-data)
GET  /api/v1/apps             - List installed apps
POST /api/v1/apps/:pkg/launch - Launch app (reuse launch-app action)
POST /api/v1/apps/:pkg/stop   - Force stop app
POST /api/v1/apps/:pkg/clear  - Clear app cache/data
DELETE /api/v1/apps/:pkg      - Uninstall app
GET  /api/v1/apps/:pkg/pull   - Extract APK to download
```

**Upload Flow:**
1. Receive APK via multer (temp file)
2. Push to device: `adb push /tmp/app.apk /data/local/tmp/`
3. Install: `pm install -r /data/local/tmp/app.apk`
4. Clean up temp files
5. Return result with package name

**Dependencies:**
```bash
npm install multer
```

---

### Step 4: Backend - APK Extraction

Add APK pull/backup functionality.

**Flow:**
1. Get APK path: `pm path <package>`
2. Pull file: `device.pull(path)`
3. Stream to response as download

---

### Step 5: Frontend - App Manager Tab

Add new "Apps" tab to `src/web/public/index.html`.

**UI Components:**
1. **Drop Zone** - Drag-and-drop area for APK upload
2. **App List** - Grid/list of installed apps with actions
3. **Progress Indicator** - Upload/install status
4. **Action Buttons** - Launch, Stop, Clear, Uninstall per app

**Navigation Update:**
Add to `navItems` array:
```javascript
{ id: 'apps', label: 'Apps', icon: 'fa-solid fa-grid-2' }
```

---

### Step 6: Frontend - Drop Zone Component

Implement drag-and-drop APK upload.

**Features:**
- Visual feedback on drag-over
- File type validation (.apk only)
- Upload progress bar
- Status messages: Uploading → Installing → Success/Error

**Alpine.js Data:**
```javascript
uploadState: 'idle', // idle | uploading | installing | success | error
uploadProgress: 0,
uploadError: null
```

---

### Step 7: Frontend - App List & Actions

Display installed apps with management controls.

**Per-App Actions:**
- Launch (play icon)
- Force Stop (stop icon)
- Clear Cache (broom icon)
- Uninstall (trash icon)

**App Card Display:**
- Package name
- Version
- Size (formatted)
- Action buttons

---

### Step 8: Scheduler Integration

Register new actions for scheduled task support.

**Update `src/web/routes/api.js` action schemas:**
```javascript
'force-stop': { type: 'force-stop', params: [{ name: 'package', required: true }] },
'clear-cache': { type: 'clear-cache', params: [{ name: 'package', required: true }] }
```

**Use Case:** Schedule nightly cache cleanup for specific apps.

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/services/app-manager.js` | NEW - App query service |
| `src/actions/install-app.js` | NEW - Install action |
| `src/actions/uninstall-app.js` | NEW - Uninstall action |
| `src/actions/force-stop.js` | NEW - Force stop action |
| `src/actions/clear-cache.js` | NEW - Clear cache action |
| `src/actions/index.js` | MODIFY - Register new actions |
| `src/web/routes/api.js` | MODIFY - Add app management endpoints |
| `src/web/public/index.html` | MODIFY - Add Apps tab UI |
| `src/web/public/js/app.js` | MODIFY - Add app management logic |
| `package.json` | MODIFY - Add multer dependency |

## Dependencies

```json
{
  "multer": "^1.4.5-lts.1"
}
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large APK upload timeout | Stream upload, increase timeout for install endpoint |
| Device disconnection during install | Check connection before operations, clean up temp files |
| Insufficient storage | Check available space before push |

## Out of Scope (Future)

- MQTT/HA integration for app buttons (Epic C)
- Batch operations UI
- App icon fetching
- Pinned apps on dashboard
