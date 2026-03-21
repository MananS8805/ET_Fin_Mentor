# Supabase Setup Guide - ET FinMentor

## Overview
This guide walks through setting up your Supabase project for ET FinMentor. All user profile data, SIP streaks, and alert dismissals are stored in Supabase.

## Prerequisites
- Supabase account (free tier sufficient for development)
- Supabase project created  
- Project URL and Anon Key obtained

## Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings > API** (or **Project Settings > API for older UI**)
4. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **Anon Key** (under "Project API keys")

## Step 2: Add Credentials to .env

Create or update your`.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3: Deploy the Database Schema

**Option A: Using Supabase SQL Editor (Easy)**

1. Login to Supabase dashboard → Your Project
2. Click **SQL Editor** in the left sidebar
3. Click **"New Query"** (top right)
4. Copy the entire contents of `supabase_schema.sql` from this project
5. Paste into the SQL editor
6. Click **"Run"** at bottom right
7. You should see: "Query executed successfully"
8. Tables created: ✅ `user_profiles`, ✅ `sip_streaks`, ✅ `alert_dismissals`

**Option B: Using Supabase CLI (Advanced)**

```bash
npm install -g supabase

# Login to your Supabase account
supabase login

# Link your project
supabase link

# Run migrations
supabase db push
```

## Step 4: Enable Row Level Security (RLS)

The schema file already enables RLS with policies, but verify:

1. Go to **Supabase Dashboard → Your Project**
2. Click **SQL Editor**
3. Run this query to verify RLS is enabled:

```sql
-- Verify RLS enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

You should see:
- `user_profiles` → `t` (RLS enabled)
- `sip_streaks` → `t` (RLS enabled)
- `alert_dismissals` → `t` (RLS enabled)

## Step 5: Test Profile Sync

1. Start the app: `npm start` or `expo start`
2. Log in with a test phone number
3. Complete onboarding with profile data
4. Check Supabase: 
   - Go to **SQL Editor**
   - Run: `SELECT * FROM user_profiles;`
   - You should see your test profile

## Step 6: Test SIP Streak Logging

1. Navigate to **Life Events** screen
2. Log an SIP contribution for this month
3. In Supabase, run: `SELECT * FROM sip_streaks;`
4. You should see your streak record

## Troubleshooting

### "Could not find the table 'public.user_profiles'"
**Problem**: Schema not deployed  
**Solution**: Complete **Step 3** above (Deploy Schema)

### "Permission denied for schema public"
**Problem**: RLS policy is too restrictive  
**Solution**: Run this query in SQL Editor:

```sql
-- Verify the RLS policy on user_profiles
SELECT *
FROM pg_policies
WHERE tablename = 'user_profiles';
```

Should show policy named `own_data` with permissions for `auth.uid() = user_id`

### "EXPO_PUBLIC_SUPABASE_URL is undefined"
**Problem**: .env not read by Expo  
**Solution**:
1. Make sure `.env` file exists in project root (not `supabase/` folder)
2. Restart Expo: `expo start --clear`
3. Check `src/core/config/index.ts` loads correctly

### Profile saves locally but not to Supabase
**Problem**: Invalid session or network issue  
**Solution**:
1. Check you're logged in (auth token valid)
2. Open DevTools console, look for `[ProfileService]` logs
3. Verify `.env` credentials are correct
4. Check Supabase project is running (not paused)

### "Rate limit exceeded"
**Problem**: Too many API calls to Gemini in one session  
**Solution**: Restart the app. Limit is 100 AI requests per session.

### Cannot edit profile after saving
**Problem**: RLS policy preventing write  
**Solution**: Verify the policy allows UPSERTs:

```sql
-- Should return true
SELECT app.uid() = 'YOUR_USER_ID_HERE';
```

## Advanced: Custom Fields

To add more fields to user profiles:

1. Add column to `user_profiles` table in Supabase:

```sql
ALTER TABLE user_profiles
ADD COLUMN house_value NUMERIC DEFAULT 0;
```

2. Update TypeScript model:

```typescript
// In src/core/models/UserProfile.ts
export interface UserProfileData {
  // ... existing fields
  houseValue: number;
}
```

3. Update ProfileService mapper:

```typescript
// In src/core/services/ProfileService.ts
function toRow(profile: UserProfileData, userId: string) {
  return {
    // ... existing fields
    house_value: profile.houseValue,
  };
}

function fromRow(row: Partial<UserProfileRow>): UserProfileData {
  return createEmptyUserProfile({
    // ... existing fields
    houseValue: toNumber(row.house_value),
  });
}
```

## Security Notes

⚠️ **Important**: The Anon Key is **public** and visible in the app. It's safe to use because:
- Row-Level Security (RLS) policies restrict data access
- Users can only see their own data (`auth.uid() = user_id`)
- The key intentionally has limited permissions

For production, consider adding:
- Supabase JWT token refresh strategy
- Rate limiting on Edge Functions
- Periodic token rotation
- Move sensitive logic to Edge Functions (not client)

## Monitoring & Maintenance

### Check Usage
- **Supabase Dashboard → Usage** - View API calls, storage
- **Limits**: Free tier allows 500k API calls/month (plenty for 100+ users)

### Backup Data
```sql
-- Export all user data
SELECT * FROM user_profiles WHERE user_id IN (
  SELECT id FROM auth.users
) TO CSV;
```

### View Logs
- **Supabase Dashboard → Logs** - See query execution and errors

## Support

If you encounter issues:
1. Check Supabase Status: https://status.supabase.com
2. Review Supabase Docs: https://supabase.com/docs
3. Check app logs: `expo start --clear` & view console
4. Verify .env variables are correct

---

**Last Updated**: March 21, 2026  
**Status**: Production Ready
