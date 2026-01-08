# 🚀 Full Upgrade Deployment Steps

Follow these steps in order. Copy/paste the commands and SQL as needed.

---

## ✅ Step 1: Get Google OAuth Credentials (DO THIS FIRST)

1. Go to https://console.cloud.google.com/
2. Create/select project
3. Enable Google+ API
4. Create OAuth 2.0 Client ID (Web application)
5. Add redirect URIs:
   ```
   https://shared-todo-list-production.up.railway.app/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
6. **Copy Client ID and Client Secret** → You'll need these for Step 3

---

## ✅ Step 2: Run Database Migrations in Supabase

Go to your Supabase project → SQL Editor → New Query

### Migration 1: OAuth Support (REQUIRED)

```sql
-- Copy entire contents of: supabase/migrations/20260108_oauth_support.sql
-- This adds email column and OAuth tables
```

### Migration 2: Normalized Schema (REQUIRED)

```sql
-- Copy entire contents of: supabase/migrations/20260108_normalized_schema.sql
-- This creates subtasks_v2, attachments_v2, user_assignments tables
```

### Migration 3: Row-Level Security (OPTIONAL - Skip for now)

```sql
-- Skip this one - we're not using RLS yet
-- You can add it later if needed
```

**How to run:**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Paste Migration 1 → Click "Run"
5. Click "New Query" again
6. Paste Migration 2 → Click "Run"
7. Verify: You should see new tables in Database → Tables

---

## ✅ Step 3: Add Environment Variables to Railway

Go to your Railway project → Variables → Add these:

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://shared-todo-list-production.up.railway.app
NEXTAUTH_SECRET=b9/NQvFL82eCNFmwc75pVm2oqAhosIoSCmaA+pcxaDM=

# Google OAuth (from Step 1)
GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>

# Email Whitelist (IMPORTANT - Security!)
# Only these emails can sign up with Google/Apple OAuth
# Replace with actual email addresses for Derrick and Sefra
ALLOWED_OAUTH_EMAILS=derrick@bealeragency.com,sefra@bealeragency.com

# Enable OAuth
NEXT_PUBLIC_USE_OAUTH=true

# Keep this OFF for now - we'll enable after migration
NEXT_PUBLIC_USE_NORMALIZED_SCHEMA=false
```

**Important:**
- Replace `<YOUR_CLIENT_ID>` and `<YOUR_CLIENT_SECRET>` with actual values from Step 1
- Replace email addresses in `ALLOWED_OAUTH_EMAILS` with real emails for Derrick and Sefra
- See [OAUTH_EMAIL_WHITELIST.md](./OAUTH_EMAIL_WHITELIST.md) for details on email whitelist

---

## ✅ Step 4: Deploy to Railway

```bash
# Make sure all changes are committed
git add -A
git status

# Commit if needed
git commit -m "feat: Enable OAuth and prepare schema migration"

# Push to Railway
git push origin refactor/security-and-architecture
```

Railway will automatically redeploy with the new environment variables.

---

## ✅ Step 5: Test OAuth Login

1. Visit your Railway URL: https://shared-todo-list-production.up.railway.app
2. You should see **3 login options**:
   - "Sign in with Google" button (NEW!)
   - Existing user cards (Derrick, Sefra)
   - Or click "Get Started" to create new user with PIN

3. **Test Google Login:**
   - Click "Sign in with Google"
   - Select your Google account
   - You should be redirected back, logged in!
   - Check: Your name appears in the app

4. **Test PIN Login (verify it still works):**
   - Click on your existing user (Derrick/Sefra)
   - Enter PIN
   - Should work as before

**If OAuth works → Continue to Step 6**
**If there are issues → Check Railway logs and troubleshoot**

---

## ✅ Step 6: Run Schema Migration (Background Script)

**Important:** Do this after OAuth is stable (wait 1-2 days if you want to be cautious).

### On your local machine:

```bash
# 1. Make sure you have the latest environment variables
# Add these to your .env.local:
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# 2. Preview the migration (dry run - no changes)
npm run migrate:dry-run

# This will show:
# - How many todos will be migrated
# - What data will be copied
# - Estimated time

# 3. Run the actual migration
npm run migrate:schema

# This will:
# - Process todos in batches of 100
# - Copy subtasks from JSONB → subtasks_v2 table
# - Copy attachments from JSONB → attachments_v2 table
# - Create user assignments
# - Track progress (you can stop and resume safely)

# Expected output:
# ✅ Migration completed!
# Total todos: 245
# Migrated: 245
# Success rate: 100%
```

---

## ✅ Step 7: Verify Migration

```bash
# Run verification script
npm run migrate:verify

# This compares old JSONB data with new tables
# Expected output:
# ✅ VERIFICATION PASSED - Migration is correct!
# Subtasks verified: X
# Attachments verified: Y
# Assignments verified: Z
```

**If verification passes → Continue to Step 8**
**If there are mismatches → Check the error messages and re-run migration**

---

## ✅ Step 8: Enable Normalized Schema

Once verification passes:

1. **Update Railway environment variable:**
   ```bash
   NEXT_PUBLIC_USE_NORMALIZED_SCHEMA=true
   ```

2. **Railway will auto-redeploy**

3. **App now reads from new tables** (but still writes to both for safety)

---

## ✅ Step 9: Monitor for 1 Week

**What to watch:**
- Check Railway logs for any errors
- Test creating tasks
- Test adding subtasks
- Test uploading attachments
- Verify everything works as expected

**If any issues occur:**
```bash
# Instant rollback - just flip the flag back
NEXT_PUBLIC_USE_NORMALIZED_SCHEMA=false
```

Your old JSONB data is still there as backup!

---

## ✅ Step 10: Clean Up (Optional - Do After 2-4 Weeks)

Once you're confident everything is stable:

```sql
-- Run in Supabase SQL Editor
-- This removes old JSONB columns (data already in new tables)
ALTER TABLE todos DROP COLUMN subtasks;
ALTER TABLE todos DROP COLUMN attachments;
```

**⚠️ Warning:** Only do this after weeks of stable operation. This is permanent!

---

## 🎉 You're Done!

**What you now have:**
- ✅ OAuth login (Google + PIN)
- ✅ Normalized database (better performance)
- ✅ Zero downtime migration
- ✅ Backward compatible

**Cost:**
- OAuth: $0/month
- Schema migration: $0/month
- Total: $0/month

---

## 🆘 Troubleshooting

### OAuth Issues

**"Invalid callback URL"**
→ Check redirect URI in Google Console matches exactly

**"Session error"**
→ Verify NEXTAUTH_SECRET is set in Railway

**OAuth button doesn't appear**
→ Check NEXT_PUBLIC_USE_OAUTH=true in Railway

### Migration Issues

**"Permission denied"**
→ Use SUPABASE_SERVICE_ROLE_KEY (not anon key)

**"Table not found"**
→ Run database migrations first (Step 2)

**"Verification failed"**
→ Check specific error messages
→ Safe to re-run migration

---

## 📞 Need Help?

See detailed guides:
- [OAUTH_DEPLOYMENT_GUIDE.md](./OAUTH_DEPLOYMENT_GUIDE.md) - Full details
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical overview
- Railway logs: `railway logs` or check Railway dashboard
