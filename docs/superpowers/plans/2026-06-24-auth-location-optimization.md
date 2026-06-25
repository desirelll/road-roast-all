# Auth Location Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize avatar/nickname authorization and location authorization so user identity stays complete while location prompts become low-interruption.

**Architecture:** Keep WeChat page APIs in existing page files, and extract only small pure helpers that can be tested without the WeChat runtime. Homepage owns first-use identity authorization and map positioning state; profile owns editable user info; ranking uses the same location decision shape for city scope.

**Tech Stack:** WeChat Mini Program native JavaScript/WXML/WXSS, WeChat cloud functions, Node.js built-in test runner for pure helper tests.

---

## File Structure

- Create `road-roast/utils/location-auth.js`: classify location failures and permission state in pure functions.
- Create `tests/location-auth.test.js`: Node tests for the pure helper behavior.
- Modify `road-roast/pages/index/index.js`: add `authChecking`, low-interruption location state, upload/save helper, and open-setting retry.
- Modify `road-roast/pages/index/index.wxml`: gate auth overlay behind `!authChecking`, update location button/placeholder text.
- Modify `road-roast/pages/index/index.wxss`: add small auth checking and location hint styles.
- Modify `road-roast/pages/profile/profile.js`: upload avatar before saving, debounce nickname save, sync global user info, recover on failure.
- Modify `road-roast/pages/profile/profile.wxml`: show save status in the profile header.
- Modify `road-roast/pages/profile/profile.wxss`: style save status text.
- Modify `road-roast/pages/ranking/ranking.js`: reuse helper decisions for city location authorization.
- Modify `ROADMAP.md`: record this complex UX change.

## Tasks

### Task 1: Location helper tests and implementation

**Files:**
- Create: `road-roast/utils/location-auth.js`
- Create: `tests/location-auth.test.js`

- [ ] **Step 1: Write failing helper tests**

```javascript
const test = require('node:test')
const assert = require('node:assert/strict')
const { isLocationDenied, shouldGuideLocationSetting } = require('./location-auth')

test('isLocationDenied detects common WeChat denial messages', () => {
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail auth deny' }), true)
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail authorize no response' }), true)
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail system permission denied' }), true)
})

test('isLocationDenied ignores non-permission failures', () => {
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail timeout' }), false)
  assert.equal(isLocationDenied({}), false)
})

test('shouldGuideLocationSetting only guides after explicit denial', () => {
  assert.equal(shouldGuideLocationSetting({ 'scope.userLocation': false }), true)
  assert.equal(shouldGuideLocationSetting({ 'scope.userLocation': true }), false)
  assert.equal(shouldGuideLocationSetting({}), false)
})
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run: `node --test tests/location-auth.test.js`

Expected: FAIL because `./location-auth` does not exist.

- [ ] **Step 3: Implement minimal helpers**

```javascript
function isLocationDenied(err = {}) {
  const msg = err.errMsg || ''
  return msg.includes('auth deny')
    || msg.includes('authorize no response')
    || msg.includes('system permission denied')
}

function shouldGuideLocationSetting(authSetting = {}) {
  return authSetting['scope.userLocation'] === false
}

module.exports = { isLocationDenied, shouldGuideLocationSetting }
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run: `node --test tests/location-auth.test.js`

Expected: PASS.

### Task 2: Homepage identity authorization

**Files:**
- Modify: `road-roast/pages/index/index.js`
- Modify: `road-roast/pages/index/index.wxml`
- Modify: `road-roast/pages/index/index.wxss`

- [ ] **Step 1: Add state fields and auth check flow**

Add `authChecking: true` and `locationStatus: 'idle'` to page data. Update `checkAuthState()` so it sets `authChecking: false` only after app-level auth check completes or times out, and only then shows the authorization overlay.

- [ ] **Step 2: Keep authorization submit focused on identity**

Update `onAuthSubmit()` so successful identity authorization updates app/page user state, clears temp fields, and does not call `getLocation()`.

- [ ] **Step 3: Update WXML gate**

Change the auth overlay condition to `wx:if="{{!authChecking && !isAuthorized}}"`. Add a small checking view only while `authChecking` is true.

- [ ] **Step 4: Run syntax check**

Run: `node --check road-roast/pages/index/index.js`

Expected: no syntax errors.

### Task 3: Homepage low-interruption location

**Files:**
- Modify: `road-roast/pages/index/index.js`
- Modify: `road-roast/pages/index/index.wxml`
- Modify: `road-roast/pages/index/index.wxss`

- [ ] **Step 1: Import location helpers**

Add `const { isLocationDenied, shouldGuideLocationSetting } = require('../../utils/location-auth')`.

- [ ] **Step 2: Update `getLocation(options)`**

Allow `getLocation({ silent: true })`. On failure, always render the default map by setting `mapLoaded: true` and `mapLoading: false`; only show user-facing guidance when `silent` is false.

- [ ] **Step 3: Update locate button flow**

Use `wx.getSetting()` in `onLocateUser()`. If `shouldGuideLocationSetting(res.authSetting)` is true, show the settings modal. Otherwise call `getLocation({ silent: false })`.

- [ ] **Step 4: Retry after settings**

After `wx.openSetting()`, call `getLocation({ silent: false })` only if returned settings have `scope.userLocation` true.

- [ ] **Step 5: Run syntax check**

Run: `node --check road-roast/pages/index/index.js`

Expected: no syntax errors.

### Task 4: Profile avatar and nickname save

**Files:**
- Modify: `road-roast/pages/profile/profile.js`
- Modify: `road-roast/pages/profile/profile.wxml`
- Modify: `road-roast/pages/profile/profile.wxss`

- [ ] **Step 1: Add save state**

Add `savingProfile: false`, `profileSaveText: ''`, and `lastSavedUserInfo: null` to page data.

- [ ] **Step 2: Upload avatar before save**

Update `onChooseAvatar()` to upload `e.detail.avatarUrl` to `avatar/profile-...jpg`, then call `saveProfile()` with the cloud `fileID`.

- [ ] **Step 3: Debounce nickname saving**

Update nickname handling so `onNicknameInput()` changes local state, clears any previous timer, and saves after a short delay. Bind WXML to `bindinput` instead of `bindchange`.

- [ ] **Step 4: Make save failure recover**

Update `saveProfile()` so it sets saving status, calls `user-info`, syncs `app.globalData.userInfo` on success, and calls `loadUserInfo()` on failure.

- [ ] **Step 5: Run syntax check**

Run: `node --check road-roast/pages/profile/profile.js`

Expected: no syntax errors.

### Task 5: Ranking city location authorization

**Files:**
- Modify: `road-roast/pages/ranking/ranking.js`

- [ ] **Step 1: Import helper**

Add `const { shouldGuideLocationSetting } = require('../../utils/location-auth')`.

- [ ] **Step 2: Add permission-aware city lookup**

Before `getUserCity()` attempts `wx.getLocation`, check settings. If location was denied, show the settings modal when the user explicitly requested city scope.

- [ ] **Step 3: Preserve national ranking fallback**

If city lookup still fails, keep `scope: 'national'` and show a toast.

- [ ] **Step 4: Run syntax check**

Run: `node --check road-roast/pages/ranking/ranking.js`

Expected: no syntax errors.

### Task 6: Documentation and verification

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Record change**

Add a `2026-06-24 — 授权体验优化` entry under completed work with changed behavior and touched files.

- [ ] **Step 2: Run full available verification**

Run:

```bash
node --test tests/location-auth.test.js
node --check road-roast/pages/index/index.js
node --check road-roast/pages/profile/profile.js
node --check road-roast/pages/ranking/ranking.js
```

Expected: all commands pass.
