# Fix Remote Tab OK Button - Implementation Plan

## Problem Statement

The OK button in the Remote Tab's D-Pad interface cannot be clicked. Users report that clicking the OK button has no effect.

## Root Cause Analysis

**File:** `src/web/public/index.html` (lines 550-593)

The D-Pad container structure has a **decorative overlay div** that blocks pointer events:

```html
<!-- Line 551: D-Pad container -->
<div class="relative w-44 h-44 ... flex items-center justify-center">

  <!-- Line 552: PROBLEM - Decorative ring overlay -->
  <div class="absolute inset-2 rounded-full border border-gray-700/30"></div>

  <!-- Lines 554-584: Direction buttons (absolute positioned - work fine) -->
  <button class="absolute top-2 ...">Up</button>
  <button class="absolute bottom-2 ...">Down</button>
  <button class="absolute left-2 ...">Left</button>
  <button class="absolute right-2 ...">Right</button>

  <!-- Lines 586-592: OK button (NOT absolute - centered via flex) -->
  <button @click="sendKeyEvent('KEYCODE_DPAD_CENTER')">OK</button>
</div>
```

**Why it fails:**
1. The decorative div at line 552 uses `absolute inset-2` creating a full overlay
2. The OK button is positioned via flexbox (not absolute), sitting in the center
3. The decorative div sits **above** the OK button in the stacking context
4. All click events on the OK button are intercepted by the decorative div

**Why direction buttons work:**
- They use `absolute` positioning with explicit offsets (`top-2`, `left-2`, etc.)
- They are positioned at the edges, outside the `inset-2` area of the decorative div

## Solution

Add `pointer-events-none` to the decorative div to allow clicks to pass through.

## Implementation Steps

### Step 1: Fix the decorative div (1 line change)

**File:** `src/web/public/index.html`
**Line:** 552

**Before:**
```html
<div class="absolute inset-2 rounded-full border border-gray-700/30"></div>
```

**After:**
```html
<div class="absolute inset-2 rounded-full border border-gray-700/30 pointer-events-none"></div>
```

## Verification

1. Start the web server: `npm run dev`
2. Navigate to Remote Tab
3. Click the OK button - should show toast "Sent: DPAD_CENTER"
4. Verify all other D-Pad buttons still work (Up, Down, Left, Right)
5. Verify function buttons still work (Back, Home, Volume)

## Risk Assessment

- **Risk Level:** Very Low
- **Scope:** Single CSS class addition
- **Side Effects:** None - the div is purely decorative
- **Rollback:** Remove the `pointer-events-none` class

## Files Changed

| File | Change |
|------|--------|
| `src/web/public/index.html` | Add `pointer-events-none` to line 552 |

## Estimated Effort

- Implementation: < 1 minute
- Testing: 2-3 minutes
