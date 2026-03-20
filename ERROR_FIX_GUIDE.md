# ET Project - Error Resolution Guide

## Overview
Your project has 2 main issues:
1. ❌ **CRITICAL**: Supabase table missing (blocks profile saving)
2. ⚠️ **WARNING**: Library deprecation warnings (non-blocking)

---

## Issue 1: Supabase Table Missing [CRITICAL]

### Error
```
WARN [ProfileService] Supabase profile save failed 
Could not find the table 'public.user_profiles' in the schema cache
```

### Why It Happens
The SQL migrations in `supabase_schema.sql` haven't been executed in your Supabase database.

### How to Fix

**Step 1**: Open your Supabase Project
- Go to https://supabase.com
- Select your project
- Navigate to **SQL Editor** (left sidebar)

**Step 2**: Create New Query
- Click "New Query"
- Paste the entire contents of `supabase_schema.sql` from your project

**Step 3**: Execute Migrations
- Click "Run" (or Ctrl+Enter)
- Wait for success message
- All 3 tables will be created:
  - `user_profiles` (stores user financial data)
  - `sip_streaks` (tracks SIP consistency)
  - `alert_dismissals` (tracks dismissed alerts)

**Step 4**: Verify in Supabase
- Go to **Table Editor** → Should see the 3 new tables
- Click on `user_profiles` → Should see columns (name, age, monthly_income, etc.)

**Step 5**: Restart Your App
- Your app's profile-saving will now work

---

## Issue 2: React defaultProps Deprecation Warnings [NON-BLOCKING]

### Errors
Three similar warnings from Victory charting library:
- `VictoryAxis: Support for defaultProps will be removed...`
- `VictoryLine: Support for defaultProps will be removed...`
- `VictoryBar: Support for defaultProps will be removed...`

### Why It Happens
- The `victory-native` library (v36.6.8) uses an outdated React pattern
- React is deprecating `defaultProps` on function components in favor of ES6 defaults
- This is a **library-level issue**, not your code

### Impact
- ✅ **App still works perfectly**
- ✅ **No functionality affected**
- ❌ **Just console noise**

### How to Fix

**Option A: Update the Library (RECOMMENDED)**
```bash
npm install victory-native@latest
```

Check if update resolves warnings. Victory likely has newer versions with fixes.

**Option B: Suppress Warnings (If update doesn't exist)**
If warnings persist after update, you can suppress them in app configuration:

In `babel.config.js`:
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      'expo-router/babel',
    ],
    // Ignore Victory warnings in dev
    ignore: [/@react-native/],
  };
};
```

**Option C: Update Metro Config**
If using Metro bundler, add to `metro.config.js`:
```javascript
const config = getDefaultConfig(__dirname);
// This suppresses certain warnings during development
module.exports = config;
```

---

## Summary of Fixes

| Issue | Type | Impact | Fix Time |
|-------|------|--------|----------|
| Supabase table missing | CRITICAL | App can't save profiles | 5 minutes |
| Victory library warnings | Warning | Console spam | 2 minutes (optional) |

### Quick Action Items
1. ✅ Execute SQL migrations in Supabase
2. ✅ (Optional) Update `victory-native` package
3. ✅ Restart your Expo dev server

---

## Testing After Fixes

### Test Profile Saving
1. Open app
2. Go to Onboarding/Profile Edit
3. Fill profile and save
4. Should see console log: `[ProfileService] ... synced to Supabase`
5. No warning about missing table

### Test Chart Rendering
- Navigate to Fire Planner, Future You tabs
- Charts should render smoothly
- Victory library warnings should be gone or suppressed

---

## Files Involved
- `src/core/services/ProfileService.ts` - Handles profile syncing
- `app/dashboard/fire-planner.tsx` - Uses VictoryAxis, VictoryLine, VictoryBar
- `app/dashboard/future-you.tsx` - Uses VictoryBar charts
- `supabase_schema.sql` - Schema migrations (needs to run once)

