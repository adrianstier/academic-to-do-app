# API Routes Bug Report

## Critical (security/data loss)

- **BUG-API-1**: [src/app/api/health/env-check/route.ts:19] **Service role key prefix leaked in health endpoint**. The env-check endpoint exposes `SUPABASE_SERVICE_ROLE_KEY_PREFIX: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10)` and `SUPABASE_SERVICE_ROLE_KEY_LENGTH`. This leaks partial secret material and the key length to any unauthenticated caller. The entire endpoint has no authentication at all -- anyone can hit `GET /api/health/env-check` and learn which services are configured, key lengths, key prefixes, and all environment variable names containing "SUPABASE" (line 33: `ALL_SUPABASE_VARS`).

- **BUG-API-2**: [src/lib/sessionValidator.ts:85-116] **Legacy auth bypass allows impersonation via X-User-Name header**. If no session token is present but an `X-User-Name` header is provided, the system accepts the request as authenticated by simply looking up the username in the database (lines 95-116). Any attacker who knows a valid username can impersonate that user by setting the `X-User-Name` header. There is no password/PIN verification in this path. This is labeled "temporary backward compatibility" but is a critical auth bypass.

- **BUG-API-3**: [src/lib/apiAuth.ts:66] **verifyTodoAccess uses anon key, bypassing team isolation**. The `verifyTodoAccess` function creates a Supabase client with the anon key (line 13-14) and queries `todos` by ID only (line 69-72) with no `team_id` filter. If RLS policies are not perfectly configured, this could allow cross-tenant data access. The `attachments` route uses this function (lines 91, 289, 364) for access control, meaning attachment upload/download/delete may not be properly team-scoped.

- **BUG-API-4**: [src/app/api/digest/generate/route.ts:169-197] **Digest generation queries are not team-scoped**. The `generateDigestForUser` function (lines 170-197) queries `todos` and `activity_log` without any `team_id` filter. This means the cron-generated digests include tasks and activity from ALL teams, leaking cross-tenant data into user digests.

- **BUG-API-5**: [src/app/join/[token]/page.tsx:86-87,200-204] **Client-side invitation token lookup and account creation with no server-side validation**. The join page queries `team_invitations` directly from the client-side Supabase client. If RLS is not correctly configured, any user could enumerate invitations. More critically, account creation (line 214-226) inserts a new user directly from the client with `supabase.from('users').insert(...)`. The user creation and invitation acceptance happen entirely client-side with the anon key, meaning RLS policies are the only guard. PIN hashes are sent from client to database directly.

- **BUG-API-6**: [src/app/signup/page.tsx:169-215] **Client-side user and team creation with no server-side validation**. Similar to BUG-API-5: the signup page creates users and teams entirely from the client-side using the anon Supabase key. There is no server-side API endpoint validating inputs, enforcing rate limits, or preventing abuse. An attacker could script mass user/team creation.

- **BUG-API-7**: [src/lib/csrf.ts:51-55] **CSRF token comparison is NOT constant-time despite the comment**. The code hashes both tokens and then uses `===` for comparison (line 55: `return cookieHash === headerHash`). JavaScript's `===` on strings is NOT constant-time. While hashing reduces the direct timing signal, a proper `crypto.timingSafeEqual` should be used on the hash buffers. This is a theoretical timing attack vector.

- **BUG-API-8**: [src/app/api/templates/route.ts:17] **SQL injection via string interpolation in PostgREST filter**. The templates GET handler constructs a filter with: `.or(`created_by.eq."${context.userName}",is_shared.eq.true`)`. The `context.userName` is interpolated directly into the PostgREST filter string. If a username contains special characters like `"`, `,`, or `)`, it could alter the filter logic, potentially exposing templates from other teams or users.

## High (broken functionality)

- **BUG-API-9**: [src/app/api/todos/route.ts:38-39] **Team scoping is skipped when teamId is empty string**. In single-tenant mode, `context.teamId` is set to `''` (empty string -- see teamAuth.ts line 103). The check `if (context.teamId)` evaluates to `false` for empty string, so it correctly skips team filtering. However, if multi-tenancy is enabled and a user somehow gets an empty teamId, ALL todos from ALL teams would be returned. The `withTeamAuth` wrapper should prevent this, but it is a defense-in-depth gap present across todos, activity, templates, goals, milestones, categories, patterns, reminders, push-subscribe, push-send, and digest/latest routes.

- **BUG-API-10**: [src/app/api/push-subscribe/route.ts:27] **userId set to userName instead of actual user ID**. The push-subscribe route sets `const userId = context.userName` (line 27) instead of `context.userId`. This means device tokens are stored with the username as `user_id`, but the push-send route (line 203-207) queries `device_tokens` by actual user IDs from the `users` table. These will never match, so web push notifications will never be delivered.

- **BUG-API-11**: [src/app/api/push-subscribe/route.ts:88] **Same bug in DELETE handler** -- `const userId = context.userName` on line 88, and again on line 149 in the GET handler. All three handlers use userName where userId is needed, making the entire push subscription system non-functional.

- **BUG-API-12**: [src/lib/serverLockout.ts:93-104] **Lockout check fails open on Redis error**. When Redis throws an exception during `checkLockout`, the catch block returns `isLocked: false` (line 99-104). This means if Redis is temporarily unavailable, all lockout protections are bypassed and brute-force attacks can proceed. This contradicts the fail-closed approach used in `rateLimit.ts` (line 104-116).

- **BUG-API-13**: [src/lib/serverLockout.ts:54-65] **Lockout check fails open when Redis is not configured**. If Redis is not set up (which the code explicitly handles), lockout returns `isLocked: false`. Combined with BUG-API-12, this means the lockout feature provides zero protection in any non-Redis environment.

- **BUG-API-14**: [src/app/api/csp-report/route.ts:99-108] **CSP report OPTIONS handler sets Access-Control-Allow-Origin to wildcard**. The `OPTIONS` handler returns `'Access-Control-Allow-Origin': '*'`. While CSP reports are typically fire-and-forget from browsers, this CORS wildcard is overly permissive for any endpoint on the application domain.

## Medium (UX/correctness)

- **BUG-API-15**: [src/app/api/todos/reorder/route.ts:60] **`any` type used throughout reorder route**. All return types from helper functions use `any[]` (lines 60, 118, 176, 236). This defeats TypeScript's type safety and could mask runtime errors.

- **BUG-API-16**: [src/app/api/todos/reorder/route.ts:63-65] **`newOrder` is not validated as a non-negative integer**. The `newOrder` parameter from user input is used directly in `otherTasks.splice(newOrder, 0, task)` (line 140) without checking that it is a valid non-negative integer. A negative number or float could produce unexpected behavior.

- **BUG-API-17**: [src/app/api/todos/reorder/route.ts:66-68] **`direction` parameter not validated**. The `direction` field from user input is passed directly to `moveUpOrDown` without validating it is `'up'` or `'down'`. An invalid string would silently produce no results rather than returning an error.

- **BUG-API-18**: [src/app/api/attachments/route.ts:265-267] **Error response leaks internal error messages**. The POST handler's catch block returns `error.message` to the client (line 266): `error: error instanceof Error ? error.message : 'Internal server error'`. The same pattern appears in the DELETE (line 333) and GET (line 389) handlers. Internal error messages (database errors, stack traces) should not be exposed to clients.

- **BUG-API-19**: [src/app/api/ai/smart-parse/route.ts:108,186] **User input directly interpolated into AI prompt without sanitization**. The `text` from user input is directly embedded into the prompt string (line 108: `${text}`) without using the `promptSanitizer` module that exists in the codebase. This pattern is repeated across all AI routes: breakdown-task, enhance-task, parse-voicemail, generate-email, translate-email, parse-content-to-subtasks, and transcribe. While these routes are behind auth, prompt injection could cause the AI to produce malicious outputs.

- **BUG-API-20**: [src/app/api/ai/smart-parse/route.ts:244] **Error details leaked to client in AI error responses**. Multiple AI routes return `details: errorMessage` in their error responses (smart-parse line 244, breakdown-task line 196, enhance-task line 106, parse-content-to-subtasks line 158). These may contain internal API error messages from Anthropic.

- **BUG-API-21**: [src/app/api/reminders/route.ts:69] **Reminders GET allows filtering by arbitrary userId parameter**. The `userId` search parameter (line 41) allows any authenticated user to fetch reminders for any other user by ID. There is no check that the requesting user is the same as the queried `userId`. Team scoping via `todos.team_id` provides some isolation, but within a team any member can see any other member's reminders.

- **BUG-API-22**: [src/lib/promptSanitizer.ts:193-198] **`isInputSafe` uses regex with global flag causing stateful bugs**. The `INJECTION_PATTERNS` array uses regexes with the `g` flag (e.g., line 13: `/ignore\s+(all\s+)?previous\s+instructions?/gi`). When `isInputSafe` iterates and calls `.test()` on these global regexes, JavaScript's regex `lastIndex` state persists between calls. This means the function will produce alternating true/false results for the same input on consecutive calls. The same bug affects `sanitizePromptInput` when `pattern.test(sanitized)` is called (line 131).

- **BUG-API-23**: [src/app/api/auth/[...nextauth]/route.ts:113] **NextAuth debug mode enabled in all environments**. Line 113 has `debug: true` hardcoded. This should be `process.env.NODE_ENV === 'development'` or removed for production. Debug mode logs sensitive session/JWT information.

- **BUG-API-24**: [src/app/api/digest/latest/route.ts:103-107] **Digest latest looks up user by userName, not by userId from session**. The route fetches the user record by `name` match (line 106: `.eq('name', userName)`) to get the `user.id`, then uses that to query digests. If two users have similar names or the name was changed, this lookup could fail or return wrong data. The `context.userId` should be used directly.

- **BUG-API-25**: [src/app/api/goals/milestones/route.ts:184-201] **`updateGoalProgress` is not team-scoped**. The helper function queries and updates milestones/goals by `goal_id` only, without any `team_id` filter. Since it uses the service role key (bypassing RLS), this could theoretically modify goals across teams if goal IDs somehow collided. More practically, this is a defense-in-depth gap.

## Low (code quality)

- **BUG-API-26**: [src/lib/secureAuth.ts:153] **Legacy PIN comparison is not constant-time**. The `verifyPin` function's legacy path (line 153) uses `legacyHash === storedHash` for comparison. Unlike the salted path which uses constant-time comparison (lines 78-87), the legacy path is vulnerable to timing attacks.

- **BUG-API-27**: [src/lib/teamAuth.ts:21] **Fallback to anon key when service role key is missing**. Line 21-22: `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!`. The teamAuth module is used for server-side authorization checks. If the service role key is not configured, it silently falls back to the anon key, which may be blocked by RLS policies, causing hard-to-debug authorization failures.

- **BUG-API-28**: [src/app/api/ai/parse-file/route.ts:6] **Anthropic client created without explicit API key**. Line 6: `const anthropic = new Anthropic();` relies on the `ANTHROPIC_API_KEY` environment variable being set. Unlike other AI routes that explicitly pass the key, this will throw an unclear error if the env var is missing. Other routes like parse-voicemail (line 19-29) handle the missing key case gracefully.

- **BUG-API-29**: [src/lib/securityMonitor.ts:117-139] **In-memory event store will leak memory in long-running processes**. The `eventStore` Map grows unbounded. While events have a 1-hour TTL, cleanup only happens when new events are stored for the same key (line 136). Keys that stop receiving events will never be cleaned up. In a long-running server, this could lead to memory growth.

- **BUG-API-30**: [src/app/api/activity/route.ts:14] **Activity log limit upper bound of 200 may be too high for performance**. While the limit is capped at 200 (line 14), returning 200 activity log entries with full details could be slow. Consider whether pagination would be more appropriate.

- **BUG-API-31**: [src/lib/fieldEncryption.ts:295-313] **`reEncryptField` function is incomplete**. The function is supposed to re-encrypt with a new key but the actual re-encryption with the new key is never performed (line 312 just returns the decrypted value). The `newKey` parameter is accepted but unused.

- **BUG-API-32**: [src/app/api/digest/generate/route.ts:18] **Cron endpoints reuse Outlook add-in API key**. The `OUTLOOK_ADDON_API_KEY` is shared between the Outlook add-in auth and the cron job auth (digest/generate line 18, reminders/process line 15). If either system is compromised, both are compromised. These should use separate keys.

- **BUG-API-33**: [src/app/api/todos/reorder/route.ts:150-156] **Reorder performs N individual UPDATE queries instead of batch**. The `moveToPosition` function loops through all tasks and performs individual UPDATE queries (lines 150-163). For a list of 100 tasks, this is 100 separate database round-trips. Should use a batch update or RPC call.

## Already Fixed (skip these)

- Team ID format validation with UUID regex in `teamAuth.ts` (lines 124-150) -- already in place
- Activity log POST validates that `context.userName` matches `user_name` in body (activity/route.ts line 56) -- already prevents spoofing
- Templates DELETE scoped by `created_by` (templates/route.ts line 103) -- already prevents deleting other users' templates
- Rate limiting fail-closed behavior in `rateLimit.ts` (lines 104-117) -- already implemented
- Session idle timeout in `sessionValidator.ts` (lines 157-173) -- already implemented
- Attachment file type and size validation (attachments/route.ts lines 103-117) -- already in place
- Service role key used appropriately in digest/generate and daily-digest for server-side cron queries
- Team-scoped queries present in most `withTeamAuth`-wrapped routes (todos, goals, activity, templates, etc.)
- `withTeamAdminAuth` used for goals and security events routes -- correct role restriction
