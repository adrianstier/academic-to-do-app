# Wave 3 Bug Bash: API Routes + Auth/Security Libs

**Date:** 2026-02-09
**Scope:** `src/app/api/**`, `src/lib/{teamAuth,apiAuth,rateLimit,csrf,secureAuth,securityMonitor,serverLockout,sessionValidator,fieldEncryption,promptSanitizer,sanitize,supabaseClient}.ts`
**Agent:** Wave 3 - API Routes + Auth/Security Libs

---

## Bugs Found & Fixed

### Bug 1: `promptSanitizer.ts` - Regex `lastIndex` not reset for `SENSITIVE_PATTERNS`
**File:** `src/lib/promptSanitizer.ts` (line 131)
**Severity:** Logic bug
**Description:** The `SENSITIVE_PATTERNS` regex patterns use the global `g` flag. When `pattern.test()` is called, the `lastIndex` advances. On subsequent calls to `sanitizePromptInput()`, the patterns may start matching from a non-zero position, causing intermittent false negatives where sensitive data (SSNs, credit cards, etc.) would not be detected. The same bug was already fixed for `INJECTION_PATTERNS` at line 115 (which has `pattern.lastIndex = 0`), but the fix was missing for `SENSITIVE_PATTERNS`.
**Fix:** Added `pattern.lastIndex = 0` before each `pattern.test()` call in the sensitive data detection loop.

### Bug 2: `templates/route.ts` - DELETE endpoint missing team_id scoping
**File:** `src/app/api/templates/route.ts` (line 103)
**Severity:** Security / Data integrity
**Description:** The DELETE handler filters by `id` and `created_by` but does not scope the query to `context.teamId`. In a multi-tenant environment, a user could delete a template belonging to another team if they share the same `created_by` username. All other operations in this file (GET, POST) correctly scope to team_id.
**Fix:** Added `team_id` filter to the delete query when `context.teamId` is present, matching the pattern used in GET and POST handlers.

### Bug 3: `apiAuth.ts` - `extractTodoIdFromPath` always returns non-null
**File:** `src/lib/apiAuth.ts` (line 148)
**Severity:** Logic bug
**Description:** The condition `parts.length >= 1` is always true for any string after `split('/')`, even for an empty string (which splits into `['']`). This means the function never returns `null` and could return an empty string as a todoId, bypassing the null check in callers like `attachments/route.ts` line 356.
**Fix:** Changed condition to `parts.length >= 2 && parts[0].length > 0`, which correctly requires both a todoId segment and an attachment segment in the path format `{todoId}/{attachmentId}.{ext}`.

### Bug 4: `securityMonitor.ts` - `getRecentEventsSummary` incorrect return type
**File:** `src/lib/securityMonitor.ts` (line 474)
**Severity:** Type mismatch
**Description:** The method declares return type `Record<SecurityEventType, number>` but actually builds and returns a `Partial<Record<SecurityEventType, number>>` (it only includes event types with count > 0). The unsafe cast `as Record<SecurityEventType, number>` at the return could cause undefined access if callers index into it expecting all keys to be present.
**Fix:** Changed the return type to `Partial<Record<SecurityEventType, number>>` and removed the unsafe cast.

### Bug 5: `health/env-check/route.ts` - No authentication on sensitive endpoint
**File:** `src/app/api/health/env-check/route.ts`
**Severity:** Security / Information disclosure
**Description:** The env-check endpoint was publicly accessible without any authentication. While it doesn't expose actual secret values, it reveals which services are configured (Redis, Sentry, API keys, etc.), which provides useful reconnaissance information for attackers.
**Fix:** Added API key authentication (using `OUTLOOK_ADDON_API_KEY`) consistent with other protected health-check endpoints like `digest/generate` and `reminders/process`.

### Bug 6: `digest/generate/route.ts` - `logger.error` wrong argument signature
**File:** `src/app/api/digest/generate/route.ts` (line 200)
**Severity:** Runtime error / Silent failure
**Description:** `logger.error` is called as `logger.error('message', { overdue: ..., today: ... }, { component: ... })`. The logger's second argument expects an `Error` object, but receives a plain object with Supabase error references. The third argument (metadata context) would be ignored because the second argument is consumed as the error. This means error details would be lost in logs.
**Fix:** Extracted the first non-null error to pass as the Error argument, and moved the individual error messages into the metadata object.

### Bug 7: `push-send/route.ts` - Module-level non-null assertions on env vars
**File:** `src/app/api/push-send/route.ts` (lines 24-25)
**Severity:** Runtime error
**Description:** `supabaseUrl` and `supabaseServiceKey` are declared with `!` non-null assertions at module scope. If the environment variables are not set, these will be `undefined` but TypeScript treats them as `string`, causing silent failures when the Supabase client is created inside the handler.
**Fix:** Changed from `!` assertions to `|| ''` fallback pattern, consistent with how all other API routes in the codebase handle these environment variables.

### Bug 8: `goals/milestones/route.ts` - `updateGoalProgress` missing team_id scoping
**File:** `src/app/api/goals/milestones/route.ts` (line 184)
**Severity:** Data integrity
**Description:** The `updateGoalProgress` helper function queries milestones and updates the goal without any `team_id` filter. While goal IDs are UUIDs and unlikely to collide, this violates the defense-in-depth pattern used everywhere else in the codebase and could theoretically allow cross-team data access.
**Fix:** Added `teamId` parameter to `updateGoalProgress` and applied `team_id` filtering to both the milestone query and the goal update. Updated all three call sites (POST, PUT, DELETE handlers).

---

## Files Modified
1. `src/lib/promptSanitizer.ts`
2. `src/app/api/templates/route.ts`
3. `src/lib/apiAuth.ts`
4. `src/lib/securityMonitor.ts`
5. `src/app/api/health/env-check/route.ts`
6. `src/app/api/digest/generate/route.ts`
7. `src/app/api/push-send/route.ts`
8. `src/app/api/goals/milestones/route.ts`

## Summary
- **8 bugs found and fixed**
- **3 security bugs** (template DELETE missing team scoping, env-check unauthenticated, extractTodoIdFromPath bypass)
- **2 data integrity bugs** (milestones updateGoalProgress missing team scoping, template delete cross-team)
- **2 logic/runtime bugs** (regex lastIndex, logger wrong arguments)
- **1 type mismatch** (securityMonitor return type)
