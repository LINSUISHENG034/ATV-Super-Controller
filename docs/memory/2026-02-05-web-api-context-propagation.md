# Web API Context Propagation Issue

**Date:** 2026-02-05  
**Issue:** YouTube URL via Web UI not working while CLI commands work

## Problem

When triggering `play-video` action via Web API, the YouTube video did not play on the TV device, even though:

- CLI command `node src/index.js test play-video --url "..."` worked fine
- `wake` and `shutdown` actions via Web API worked correctly
- Device was connected and responsive

## Root Cause

The `executeAction` function in `executor.js` passed an empty context `{}` to `executeTask`:

```javascript
// Before fix
async function executeAction(device, actionName, params = {}) {
  const task = { name: `Direct Action: ${actionName}`, actions: [...] };
  return await executeTask(task, device, {});  // ← Empty context!
}
```

The `play-video` action requires `context.youtube` to access the configured YouTube client (SmartTube). Without this context, it falls back to a generic VIEW intent that fails when no default YouTube handler is registered.

## Solution

Added global action context storage to bridge startup configuration to Web API calls:

### 1. executor.js - Add context storage

```javascript
// Global action context
let actionContext = {};

function setActionContext(context) {
  actionContext = context || {};
}

async function executeAction(device, actionName, params = {}) {
  // ...
  return await executeTask(task, device, actionContext); // Now uses global context
}
```

### 2. start.js - Set context at startup

```javascript
import { executeTask, setActionContext } from "../services/executor.js";

// After loading config...
const context = { youtube: config.youtube };
setActionContext(context); // Make available to Web API
```

## Key Learnings

1. **CLI vs Web API code paths may differ** - The scheduler's executor callback properly passed context, but direct `executeAction` calls (used by Web API) did not.

2. **"Success" doesn't mean "working"** - ADB commands returning success only means the command was sent, not that the action had the desired effect on the device.

3. **Config-dependent actions need explicit context** - When actions rely on runtime configuration (like `youtube.package`), ensure all code paths can access that configuration.

4. **Test through the actual UI** - Unit tests passed, CLI worked, but the Web API path had a different issue. Always test the actual user-facing interface.

## Files Modified

- `src/services/executor.js` - Added `setActionContext()`, `getActionContext()`, updated `executeAction()`
- `src/commands/start.js` - Call `setActionContext()` at startup

## Related Documentation

- SmartTube client configuration: `docs/memory/2026-02-03-device-testing.md`
- YouTube client config format: See `config.example.json`
