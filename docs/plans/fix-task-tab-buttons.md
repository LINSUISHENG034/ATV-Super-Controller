# Fix Plan: Task Tab Buttons Not Clickable

## Problem Summary
Task Tab中的Toggle开关和Run Now按钮无法点击，而Dashboard和Remote Tab的按钮正常工作。

## Root Cause
Alpine.js的`:disabled`绑定在值为`undefined`时，会设置`disabled`属性而不是移除它。

**问题代码：**
```html
:disabled="task.toggling"  <!-- task.toggling 为 undefined -->
:disabled="task.running"   <!-- task.running 为 undefined -->
```

当`task.toggling`和`task.running`为`undefined`时，Alpine.js将其解释为需要设置`disabled`属性。

## Solution
使用显式布尔转换确保`undefined`被正确处理为`false`。

## Implementation Steps

### Step 1: Fix Toggle Switch Button (index.html:366)
**File:** `src/web/public/index.html`
**Line:** 366

**Before:**
```html
:disabled="task.toggling"
```

**After:**
```html
:disabled="!!task.toggling"
```

### Step 2: Fix Desktop Run Now Button (index.html:378)
**File:** `src/web/public/index.html`
**Line:** 378

**Before:**
```html
:disabled="task.running"
```

**After:**
```html
:disabled="task.running === true"
```

### Step 3: Fix Mobile Run Now Button (index.html:391)
**File:** `src/web/public/index.html`
**Line:** 391

**Before:**
```html
:disabled="task.running"
```

**After:**
```html
:disabled="task.running === true"
```

### Step 4: Remove Debug Test Buttons
**File:** `src/web/public/index.html`

Remove the following debug buttons:
- Line 322: Test Button (outside x-for)
- Line 327: Test Inside x-for button
- Line 363: `onclick="console.log('Native click on toggle button')"` attribute

## Verification
1. Navigate to Task Tab
2. Verify Toggle switches are clickable and functional
3. Verify Run Now buttons are clickable and functional
4. Test on both desktop and mobile views

## Risk Assessment
- **Low Risk**: Changes are minimal and isolated to button disabled states
- **No Breaking Changes**: Existing functionality preserved
- **Backward Compatible**: Works with existing API responses
