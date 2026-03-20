# QUICK FIX CHECKLIST

## 🔴 CRITICAL FIX (Do this first)

### Supabase Table Setup (5 minutes)

- [ ] Open Supabase dashboard: https://supabase.com
- [ ] Select your project
- [ ] Go to **SQL Editor**
- [ ] Click "New Query"
- [ ] Copy this SQL code from your project file: `supabase_schema.sql`
- [ ] Paste into the query editor
- [ ] Click **Run** / Press Ctrl+Enter
- [ ] Wait for "Success!" message
- [ ] Verify in **Table Editor** - see 3 new tables:
  - [ ] user_profiles
  - [ ] sip_streaks
  - [ ] alert_dismissals
- [ ] Restart your Expo dev server (stop and `npm run android` or `expo start`)
- [ ] Test profile saving - should work without "table not found" error

---

## 🟡 OPTIONAL FIX (Do if you want clean console)

### Update Victory Library (2 minutes)

```bash
npm install victory-native@latest
```

Then restart Expo server.

---

## ✅ VERIFICATION

After fixes, test these:

- [ ] **Profile Page**: Can save/edit user profile without errors
- [ ] **Fire Planner Tab**: Loads charts without "defaultProps" warnings
- [ ] **Future You Tab**: Shows projections without warnings
- [ ] **Console**: No more "Could not find the table" errors

---

## 📝 Notes

**Issue 1 (Supabase)**: Blocks core functionality - MUST FIX
**Issue 2 (Warnings)**: Just console spam - nice to have

See `ERROR_FIX_GUIDE.md` for detailed information.

