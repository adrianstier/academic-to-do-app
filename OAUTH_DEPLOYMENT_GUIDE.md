# OAuth + Schema Migration Deployment Guide

This guide walks you through deploying both OAuth authentication and database schema normalization.

---

## 🎯 Overview

You now have **two major upgrades** ready to deploy:

1. **OAuth Authentication** - Let users sign in with Google/Apple instead of just PIN
2. **Schema Normalization** - Move from JSONB to proper relational tables

Both are **optional** and can be enabled independently using feature flags.

---

## 📋 Part 1: OAuth Authentication (Google + Apple Login)

### Step 1: Get Google OAuth Credentials (15 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **Web application**
   - Name: "Bealer Agency Todo App"
   - Authorized JavaScript origins:
     ```
     https://your-domain.com
     http://localhost:3000  (for testing)
     ```
   - Authorized redirect URIs:
     ```
     https://your-domain.com/api/auth/callback/google
     http://localhost:3000/api/auth/callback/google  (for testing)
     ```
   - Click "Create"

5. **Copy the credentials**:
   - Client ID: `123456789-abc...apps.googleusercontent.com`
   - Client Secret: `GOCSPX-abc123...`

### Step 2: Get Apple OAuth Credentials (30 minutes, OPTIONAL)

> **Note**: Apple OAuth is more complex. You can skip this and just use Google initially.

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a **Service ID**:
   - Navigate to "Certificates, Identifiers & Profiles"
   - Click "Identifiers" → "+" → "Service IDs"
   - Description: "Bealer Agency Todo"
   - Identifier: `com.bealeragency.todo.signin`

3. Configure Sign in with Apple:
   - Check "Sign in with Apple"
   - Click "Configure"
   - Domains: `your-domain.com`
   - Return URLs: `https://your-domain.com/api/auth/callback/apple`
   - Save

4. Create a **Key**:
   - Go to "Keys" → "+"
   - Key Name: "Bealer Todo Sign in with Apple"
   - Check "Sign in with Apple"
   - Save and download the `.p8` file (you can't download it again!)

5. **Copy the credentials**:
   - Service ID: `com.bealeragency.todo.signin`
   - Team ID: Found in top-right of Apple Developer portal
   - Key ID: From the key you just created
   - Private Key: Contents of the `.p8` file

### Step 3: Update Environment Variables

Add these to your `.env` file:

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=YOUR_SECRET_HERE  # Generate with: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple OAuth (optional)
APPLE_ID=com.bealeragency.todo.signin
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
APPLE_KEY_ID=YOUR_KEY_ID

# Feature Flag to Enable OAuth
NEXT_PUBLIC_USE_OAUTH=true
```

**Generate NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

### Step 4: Run Database Migration

In your Supabase SQL Editor, run this migration:

```bash
# Copy the contents of this file to Supabase SQL Editor:
supabase/migrations/20260108_oauth_support.sql
```

This adds:
- `email` column to `users` table
- `auth_provider` column (tracks if user signed up via PIN, Google, or Apple)
- OAuth tables (`accounts`, `sessions`, `verification_tokens`)

### Step 5: Deploy to Railway

```bash
# Commit changes
git add .
git commit -m "feat: Add OAuth authentication (Google + Apple)"
git push origin refactor/security-and-architecture

# Add environment variables in Railway dashboard:
# - NEXTAUTH_URL
# - NEXTAUTH_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - NEXT_PUBLIC_USE_OAUTH=true
```

### Step 6: Test OAuth Login

1. Visit your deployed app
2. You should see **3 login options**:
   - "Sign in with Google" button
   - "Sign in with Apple" button (if configured)
   - Existing PIN login (still works!)

3. Try signing in with Google:
   - Click "Sign in with Google"
   - Select your Google account
   - You'll be redirected back to the app, logged in!

---

## 🗄️ Part 2: Schema Migration (JSONB → Relational Tables)

### When to Run This

**Recommendation**: Wait 1-2 weeks after OAuth is stable, then do schema migration.

**Current setup works fine for**:
- ✅ 2-10 users
- ✅ Hundreds of tasks
- ✅ All existing features

**You'll benefit from normalization when**:
- 📈 10+ users
- 📈 Thousands of tasks
- 📈 You want advanced reporting

### Step 1: Run Database Migration

In Supabase SQL Editor:

```bash
# Copy contents of this file:
supabase/migrations/20260108_normalized_schema.sql
```

This creates:
- `subtasks_v2` table (replaces JSONB subtasks column)
- `attachments_v2` table (replaces JSONB attachments column)
- `user_assignments` table (replaces string assigned_to)
- `schema_migration_status` table (tracks migration progress)

### Step 2: Preview Migration (Dry Run)

```bash
# Test the migration without making changes
npm run migrate:dry-run
```

This shows:
- How many todos will be migrated
- What changes will be made
- Estimated time

### Step 3: Run Background Migration

```bash
# Run the actual migration (safe, resumable)
npm run migrate:schema
```

**What happens**:
- Processes todos in batches of 100
- Copies subtasks from JSONB → subtasks_v2 table
- Copies attachments from JSONB → attachments_v2 table
- Creates user assignments
- Tracks progress (can resume if interrupted)

**How long it takes**:
- 100 todos: ~30 seconds
- 1,000 todos: ~5 minutes
- 10,000 todos: ~30 minutes

### Step 4: Verify Migration

```bash
# Check that data was copied correctly
npm run migrate:verify
```

This compares old JSONB data with new tables and reports any mismatches.

Expected output:
```
✅ VERIFICATION PASSED - Migration is correct!
Total todos verified: 245
Subtasks verified: 187
Attachments verified: 94
User Assignments verified: 203
```

### Step 5: Enable Normalized Schema

Once verification passes, enable the feature flag:

```bash
# In .env and Railway
NEXT_PUBLIC_USE_NORMALIZED_SCHEMA=true
```

**What changes**:
- App now reads from new tables (subtasks_v2, attachments_v2)
- Still writes to BOTH old and new (dual-write for safety)
- Old JSONB columns remain as backup

### Step 6: Monitor for 1 Week

Watch for any issues:
- Check Railway logs for errors
- Test creating/editing tasks
- Verify subtasks and attachments work

**If problems occur**:
```bash
# Instant rollback - just turn off the flag
NEXT_PUBLIC_USE_NORMALIZED_SCHEMA=false
```

### Step 7: Clean Up Old Columns (Optional, weeks later)

Once you're confident (2-4 weeks), you can delete old JSONB columns:

```sql
-- Only do this after weeks of stable operation!
ALTER TABLE todos DROP COLUMN subtasks;
ALTER TABLE todos DROP COLUMN attachments;
```

---

## 🚀 Deployment Checklist

### OAuth Deployment
- [ ] Get Google OAuth credentials
- [ ] (Optional) Get Apple OAuth credentials
- [ ] Add environment variables to Railway
- [ ] Run OAuth database migration in Supabase
- [ ] Deploy to Railway
- [ ] Test Google login
- [ ] Test PIN login still works

### Schema Migration (Do 1-2 weeks after OAuth)
- [ ] Run normalized schema migration in Supabase
- [ ] Run dry-run migration locally
- [ ] Run actual migration: `npm run migrate:schema`
- [ ] Verify migration: `npm run migrate:verify`
- [ ] Enable feature flag: `NEXT_PUBLIC_USE_NORMALIZED_SCHEMA=true`
- [ ] Monitor for 1-2 weeks
- [ ] (Optional) Clean up old JSONB columns

---

## 🔧 Troubleshooting

### OAuth Issues

**"Error: Invalid callback URL"**
- Check that redirect URI in Google Console matches exactly: `https://your-domain.com/api/auth/callback/google`
- Make sure NEXTAUTH_URL is set correctly

**"Session error"**
- Verify NEXTAUTH_SECRET is set
- Check that it's a random 32+ character string

**OAuth button doesn't appear**
- Check `NEXT_PUBLIC_USE_OAUTH=true` is set
- Verify environment variables are loaded in Railway

### Migration Issues

**"Migration failed: permission denied"**
- Make sure you're using `SUPABASE_SERVICE_ROLE_KEY` (not anon key)

**"Verification failed: mismatches found"**
- Check Railway logs for specific errors
- Run migration again (it's safe to re-run)
- Some mismatches might be OK (e.g., null vs empty array)

**"Schema_migration_status table not found"**
- Run the database migration first: `supabase/migrations/20260108_normalized_schema.sql`

---

## 📊 Cost Impact

**OAuth**:
- Free (Google and Apple don't charge for OAuth)

**Schema Migration**:
- No additional cost
- Same Supabase usage
- Slightly faster queries (better performance)

**Total Additional Cost**: $0/month

---

## 🎉 You're Done!

Once both are deployed, your users will have:
- ✅ **Modern login** (Google/Apple + PIN)
- ✅ **Better database structure** (normalized tables)
- ✅ **Same great features** (nothing breaks)
- ✅ **Zero downtime** (feature flags enable gradual rollout)

Questions? Check the main [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) or [REFACTORING_PLAN.md](./REFACTORING_PLAN.md).
