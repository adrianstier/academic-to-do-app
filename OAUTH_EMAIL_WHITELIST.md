# OAuth Email Whitelist Configuration

## Overview

The app now includes email whitelist protection for OAuth sign-ins (Google/Apple). Only approved email addresses can create accounts via OAuth.

**Important:** PIN-based authentication is NOT affected - anyone can still create accounts with a PIN. This whitelist only applies to OAuth providers.

## How It Works

When someone tries to sign in with Google or Apple:
1. ✅ If their email is in the whitelist → Sign-in succeeds
2. ❌ If their email is NOT in the whitelist → Sign-in rejected with error
3. ⚠️ If no whitelist is configured → Anyone can sign in (open access)

## Configuration

### Add Approved Emails to Railway

1. Go to Railway project → Variables
2. Add a new environment variable:

```
ALLOWED_OAUTH_EMAILS=derrick@bealeragency.com,sefra@bealeragency.com,adrian@example.com
```

**Format:**
- Comma-separated list of email addresses
- No spaces (or they'll be trimmed automatically)
- Case-insensitive (both `John@Example.com` and `john@example.com` work)

### Examples

**Single email:**
```
ALLOWED_OAUTH_EMAILS=derrick@bealeragency.com
```

**Multiple emails:**
```
ALLOWED_OAUTH_EMAILS=derrick@bealeragency.com,sefra@bealeragency.com,john@example.com
```

**No whitelist (open access):**
```
# Don't set ALLOWED_OAUTH_EMAILS or leave it empty
ALLOWED_OAUTH_EMAILS=
```

## Testing

### Test Authorized Email
1. Sign in with Google using an approved email
2. ✅ Should succeed and create account

### Test Unauthorized Email
1. Sign in with Google using a non-approved email
2. ❌ Should show error: "Sign in failed. Check the details you provided are correct."
3. Check Railway logs - you'll see: `Unauthorized OAuth sign-in attempt`

## Adding New Users

When you want to authorize a new person:

1. Get their email address
2. Go to Railway → Variables
3. Edit `ALLOWED_OAUTH_EMAILS`
4. Add their email to the comma-separated list
5. Save (Railway auto-redeploys)
6. User can now sign in with Google/Apple

## Removing Access

To revoke someone's OAuth access:

1. Go to Railway → Variables
2. Edit `ALLOWED_OAUTH_EMAILS`
3. Remove their email from the list
4. Save (Railway auto-redeploys)
5. They can no longer sign in with OAuth

**Note:** If they already have an account, they can still access it if they set up a PIN. To fully remove access, delete their account from Supabase → Database → users table.

## Security Notes

- ✅ Email validation happens BEFORE account creation
- ✅ Unauthorized attempts are logged for security monitoring
- ✅ Whitelist is case-insensitive
- ⚠️ PIN authentication bypasses this whitelist (by design)
- ⚠️ Make sure `ALLOWED_OAUTH_EMAILS` is set in Railway, not just locally

## Recommended Whitelist for Bealer Agency

```
ALLOWED_OAUTH_EMAILS=derrick@bealeragency.com,sefra@bealeragency.com
```

Replace with actual email addresses used by Derrick and Sefra.
