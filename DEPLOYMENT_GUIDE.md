### Deployment & Rollout Guide

**Zero-Downtime Deployment for Refactored Code**

---

## Prerequisites

### Required Services

1. **Supabase** (PostgreSQL + Real-time)
   - Create account at [supabase.com](https://supabase.com)
   - Create new project
   - Copy URL and keys

2. **Upstash Redis** (Rate Limiting)
   - Create account at [upstash.com](https://upstash.com)
   - Create Redis database
   - Copy REST URL and token

3. **Sentry** (Error Tracking)
   - Create account at [sentry.io](https://sentry.io)
   - Create new project (Next.js)
   - Copy DSN

4. **OAuth Providers** (Optional)
   - **Google**: [console.cloud.google.com](https://console.cloud.google.com)
   - **Apple**: [developer.apple.com](https://developer.apple.com)

---

## Step 1: Environment Setup

### Copy Environment Template
```bash
cp .env.example .env.local
```

### Fill in Required Variables
```bash
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Services (REQUIRED for AI features)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# NextAuth (for OAuth)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://your-domain.com

# Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Sentry (for error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://...
```

---

## Step 2: Database Migration

### Run SQL Migrations in Supabase

Execute these migrations in order in the Supabase SQL Editor:

```bash
# 1. OAuth Support
supabase/migrations/20260108_oauth_support.sql

# 2. Row-Level Security
supabase/migrations/20260108_row_level_security.sql

# 3. Normalized Schema
supabase/migrations/20260108_normalized_schema.sql
```

### Enable Real-time (if not already enabled)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE subtasks_v2;
ALTER PUBLICATION supabase_realtime ADD TABLE attachments_v2;
```

---

## Step 3: Initial Deployment (Main Branch)

### Build and Deploy Current Version
```bash
# On main branch
git checkout main
npm run build
npm start
```

This deploys the **existing stable version** - users are unaffected.

---

## Step 4: Deploy Refactored Code (New Branch)

### Merge Refactor Branch to Staging
```bash
# Create staging branch
git checkout -b staging
git merge refactor/security-and-architecture

# Install dependencies
npm install

# Build
npm run build
```

### Test Locally with Feature Flags OFF
```bash
# All flags should be false
NEXT_PUBLIC_ENABLE_OAUTH=false
ENABLE_RATE_LIMITING=false
NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA=false

npm run dev
```

**Expected**: App should work exactly like before. New code is dormant.

---

## Step 5: Gradual Rollout

### Week 1: Enable Rate Limiting (100% rollout)
```bash
# In production environment variables
ENABLE_RATE_LIMITING=true
```

**Monitor**:
- Check Upstash dashboard for rate limit metrics
- Verify legitimate users aren't blocked
- Check Sentry for any errors

**Rollback**: Set to `false` if issues arise

---

### Week 2: Enable OAuth (10% → 100%)
```bash
# Start with test users
NEXT_PUBLIC_ENABLE_OAUTH=true
```

**Test**:
- Admin user logs in with Google
- Try linking OAuth to existing PIN account
- Verify PIN login still works

**Monitor**:
- OAuth success rate
- PIN fallback working
- No authentication errors

**Scale up**: Increase to 100% after 3 days of stability

---

### Week 3: Run Schema Migration
```bash
# Dry run first
DRY_RUN=true npm run migrate:schema

# Check output, verify no errors

# Run actual migration (in background)
npm run migrate:schema

# Monitor progress
npm run migrate:status
```

**Expected Duration**: 10-30 minutes for 1,000 todos

**Monitor**:
- Migration progress
- Check for errors in `migration_errors` table
- Verify application still responsive

### Week 4: Enable Normalized Schema Reads
```bash
# Once migration is 100% complete
NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA=true
```

**Monitor**:
- Query performance (should be faster)
- Data consistency (JSONB vs tables)
- No missing subtasks/attachments

---

### Week 5: Component Refactoring (A/B Test)
```bash
# 50% of users get new components
NEXT_PUBLIC_USE_NEW_COMPONENTS=true
NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT=50
```

**Monitor**:
- Bundle size impact
- Performance metrics (Lighthouse)
- User complaints
- Error rates

**Scale up**: 50% → 100% after 3 days

---

## Step 6: Final Cutover

### After 2 Weeks of Stability
```bash
# All flags enabled
NEXT_PUBLIC_ENABLE_OAUTH=true
ENABLE_RATE_LIMITING=true
NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA=true
NEXT_PUBLIC_USE_NEW_COMPONENTS=true
NEXT_PUBLIC_USE_ZUSTAND=true
```

### Cleanup Old Code
```bash
# Merge to main
git checkout main
git merge staging

# Remove feature flag conditionals
# Delete old JSONB-only code paths
# Remove dual-write logic (keep only normalized schema)

# Deploy
npm run build
npm start
```

---

## Rollback Procedures

### If OAuth Breaks
```bash
# Instant rollback (30 seconds)
NEXT_PUBLIC_ENABLE_OAUTH=false
```
Users continue with PIN login. No data loss.

### If Rate Limiting Blocks Users
```bash
# Disable immediately
ENABLE_RATE_LIMITING=false
```
System continues without protection (temporary).

### If Schema Migration Fails
```bash
# Stop migration
pkill -f migrate-to-normalized-schema

# Restore database from backup
psql $DATABASE_URL < backup_20260108.sql

# Disable new schema
NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA=false
```

### If Components Break
```bash
# Instant rollback
NEXT_PUBLIC_USE_NEW_COMPONENTS=false
```
Old components still in codebase, work immediately.

---

## Monitoring Checklist

### Daily Checks (First 2 Weeks)
- [ ] Check Sentry for new errors
- [ ] Monitor Upstash rate limit metrics
- [ ] Check migration status: `npm run migrate:status`
- [ ] Review user feedback/complaints
- [ ] Check application performance (Vercel/Railway analytics)

### Weekly Checks
- [ ] Review rate limit effectiveness (blocked attacks)
- [ ] Check OAuth login success rate
- [ ] Verify data consistency (spot check)
- [ ] Bundle size analysis
- [ ] Test suite pass rate

---

## Environment Variables by Phase

### Production-Ready Configuration
```bash
# Security (Phase 2) - ENABLE IMMEDIATELY
ENABLE_RATE_LIMITING=true
NEXT_PUBLIC_SENTRY_ENABLED=true

# OAuth (Phase 2) - Enable after testing
NEXT_PUBLIC_ENABLE_OAUTH=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Schema (Phase 3) - Enable after migration
NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA=true

# Components (Phase 4) - Enable after A/B test
NEXT_PUBLIC_USE_NEW_COMPONENTS=true

# State (Phase 5) - Enable last
NEXT_PUBLIC_USE_ZUSTAND=true
```

---

## Success Metrics

### Phase 2 (Security)
- ✅ 0 successful brute force attacks
- ✅ Rate limiting blocks 99%+ of malicious requests
- ✅ OAuth login success rate > 95%
- ✅ No increase in authentication errors

### Phase 3 (Schema)
- ✅ Migration completes with 0 errors
- ✅ Query performance improves 20-50%
- ✅ 100% data consistency between JSONB and tables
- ✅ No user-reported data issues

### Phase 4 (Components)
- ✅ Bundle size reduces 30%+
- ✅ Lighthouse score improves
- ✅ No increase in client-side errors
- ✅ User satisfaction maintained/improved

---

## Troubleshooting

### Issue: OAuth Login Fails
**Check**:
1. Verify OAuth credentials in env
2. Check NEXTAUTH_URL matches your domain
3. Verify callback URLs in Google/Apple console
4. Check Sentry for specific error

### Issue: Rate Limiting Too Aggressive
**Check**:
1. Review rate limit thresholds in `src/lib/rateLimit.ts`
2. Check which endpoints are being limited
3. Adjust limits if needed
4. Whitelist trusted IPs if necessary

### Issue: Migration Stalls
**Check**:
1. Run `npm run migrate:status`
2. Check `migration_errors` table for specific failures
3. Verify database connection
4. Check Supabase resource limits

### Issue: Data Inconsistency
**Check**:
1. Verify dual-write is working: check both JSONB and tables
2. Run data consistency check
3. Re-run migration for affected records
4. Check for concurrent updates

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)
- **Architecture**: [CLAUDE.md](./CLAUDE.md)

---

## OAuth Authentication Setup

### Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google+ API" → Click "Enable"

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

5. Copy your Client ID and Client Secret

### Apple OAuth Credentials (Optional)

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a **Service ID**:
   - Navigate to "Certificates, Identifiers & Profiles"
   - Click "Identifiers" → "+" → "Service IDs"
   - Description: "Bealer Agency Todo"
   - Identifier: `com.bealeragency.todo.signin`

3. Configure Sign in with Apple:
   - Check "Sign in with Apple" → Click "Configure"
   - Domains: `your-domain.com`
   - Return URLs: `https://your-domain.com/api/auth/callback/apple`

4. Create a **Key**:
   - Go to "Keys" → "+"
   - Key Name: "Bealer Todo Sign in with Apple"
   - Check "Sign in with Apple"
   - Save and download the `.p8` file

### OAuth Environment Variables

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=YOUR_SECRET_HERE  # Generate: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple OAuth (optional)
APPLE_ID=com.bealeragency.todo.signin
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_KEY_ID=YOUR_KEY_ID

# Feature Flag
NEXT_PUBLIC_USE_OAUTH=true
```

### OAuth Email Whitelist

Control who can sign up via OAuth by setting allowed emails:

```bash
# In Railway/production environment
ALLOWED_OAUTH_EMAILS=derrick@bealeragency.com,sefra@bealeragency.com
```

**Behavior:**
- If whitelist is set: Only listed emails can sign up via OAuth
- If whitelist is empty: Anyone can sign up (open access)
- PIN authentication is NOT affected by the whitelist

**Adding new users:**
1. Edit `ALLOWED_OAUTH_EMAILS` in Railway
2. Add email to comma-separated list
3. Save (auto-redeploys)

**Removing access:**
1. Remove email from the list
2. To fully remove: Also delete user from Supabase → users table

---

**Last Updated**: 2026-01-13
**Version**: 1.1
