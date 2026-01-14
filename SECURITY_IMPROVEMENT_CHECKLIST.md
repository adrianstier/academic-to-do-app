# Security Improvement Checklist

## Allstate Insurance Agency Application - Security Remediation Plan

**Application:** Bealer Agency Todo List
**Risk Classification:** HIGH (Handles PII, Insurance Policy Data, Customer Communications)
**Compliance Requirements:** Allstate Information Security Standards, NAIC Model Laws, State Insurance Regulations
**Assessment Date:** 2026-01-14
**Target Completion:** 4 Weeks

---

## Executive Summary

This checklist addresses security vulnerabilities identified in the Bealer Agency Todo List application. As an Allstate affiliate handling Protected Personal Information (PPI) and insurance policy data, this application must meet enterprise-grade security standards.

**Current Risk Level:** MEDIUM-HIGH
**Post-Remediation Target:** LOW

---

## Priority Legend

| Priority | Timeline | Description |
|----------|----------|-------------|
| **P0** | 48 hours | Critical - Immediate exploitation risk |
| **P1** | 1 week | High - Active vulnerability |
| **P2** | 2 weeks | Medium - Security gap |
| **P3** | 4 weeks | Low - Best practice improvement |

---

## Phase 1: Critical Security Fixes (P0 - 48 Hours)

### 1.1 Enable Row-Level Security (RLS) in Production

**Risk:** Any authenticated user can access ALL customer data, tasks, and communications.

- [ ] **1.1.1** Enable RLS in Supabase production environment
  ```sql
  -- In Supabase SQL Editor
  ALTER SYSTEM SET app.enable_rls = 'true';
  SELECT pg_reload_conf();
  ```

- [ ] **1.1.2** Verify RLS policies are enforcing properly
  ```sql
  -- Test query as different users
  SET LOCAL app.current_user_name = 'TestUser';
  SELECT * FROM todos WHERE created_by != 'TestUser';
  -- Should return empty set
  ```

- [ ] **1.1.3** Remove fallback `ELSE true` clauses from RLS policies after verification

**Files:** `supabase/migrations/20260108_row_level_security.sql`

---

### 1.2 Add Authentication to AI Endpoints

**Risk:** Unauthenticated access to expensive AI APIs ($0.015/1K tokens) allows:
- Financial abuse (unlimited API calls)
- Data extraction via crafted prompts
- Prompt injection attacks

- [ ] **1.2.1** Create session validation middleware for AI routes
  ```typescript
  // src/lib/validateSession.ts
  export async function validateSession(request: NextRequest): Promise<{
    valid: boolean;
    userId?: string;
    userName?: string;
  }> {
    const sessionToken = request.headers.get('X-Session-Token');
    if (!sessionToken) return { valid: false };

    // Validate against database
    const { data } = await supabase
      .from('user_sessions')
      .select('user_id, user_name, expires_at')
      .eq('token', hashToken(sessionToken))
      .single();

    return {
      valid: data && new Date(data.expires_at) > new Date(),
      userId: data?.user_id,
      userName: data?.user_name
    };
  }
  ```

- [ ] **1.2.2** Apply validation to all AI endpoints:
  - `/api/ai/smart-parse`
  - `/api/ai/enhance-task`
  - `/api/ai/breakdown-task`
  - `/api/ai/transcribe`
  - `/api/ai/parse-voicemail`
  - `/api/ai/parse-file`
  - `/api/ai/parse-content-to-subtasks`
  - `/api/ai/generate-email`

- [ ] **1.2.3** Return 401 Unauthorized for invalid sessions

**Files:** All files in `src/app/api/ai/*/route.ts`

---

### 1.3 Fix CORS Configuration

**Risk:** Wildcard CORS (`*`) allows any website to call Outlook API endpoints if API key is compromised.

- [ ] **1.3.1** Restrict CORS to specific allowed origins
  ```typescript
  // next.config.ts
  const ALLOWED_ORIGINS = [
    'https://outlook.office.com',
    'https://outlook.live.com',
    'https://shared-todo-list-production.up.railway.app',
  ];

  headers: async () => [
    {
      source: '/api/outlook/:path*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: ALLOWED_ORIGINS.join(', '),
        },
        {
          key: 'Access-Control-Allow-Credentials',
          value: 'true',
        },
      ],
    },
  ],
  ```

- [ ] **1.3.2** Implement dynamic origin validation in Outlook routes
- [ ] **1.3.3** Add Origin header validation in middleware

**Files:** `next.config.ts`, `src/middleware.ts`

---

### 1.4 Remove Service Role Key from Client-Accessible Code

**Risk:** Supabase service role key bypasses ALL security policies, providing god-mode database access.

- [ ] **1.4.1** Audit all uses of `SUPABASE_SERVICE_ROLE_KEY`
  ```bash
  grep -r "SUPABASE_SERVICE_ROLE_KEY" src/
  ```

- [ ] **1.4.2** Replace service role with anon key in client-facing routes
  ```typescript
  // BEFORE (INSECURE)
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // AFTER (SECURE)
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  ```

- [ ] **1.4.3** Move file upload logic to server-only API route with proper RLS
- [ ] **1.4.4** Create dedicated storage policies for attachments

**Files:** `src/app/api/attachments/route.ts`, `src/lib/supabase.ts`

---

### 1.5 Implement Server-Side Rate Limiting (Enable by Default)

**Risk:** No rate limiting allows brute force attacks, DoS, and API abuse.

- [ ] **1.5.1** Enable rate limiting by default (remove feature flag requirement)
  ```typescript
  // src/lib/featureFlags.ts
  server_rate_limiting: () => ({
    enabled: process.env.DISABLE_RATE_LIMITING !== 'true',  // ENABLED by default
  }),
  ```

- [ ] **1.5.2** Configure Upstash Redis for production
  ```
  UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
  UPSTASH_REDIS_REST_TOKEN=xxx
  ```

- [ ] **1.5.3** Implement fail-closed behavior (deny on Redis failure)
  ```typescript
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail CLOSED - deny request if rate limiting unavailable
    return { success: false, error: 'Service temporarily unavailable' };
  }
  ```

- [ ] **1.5.4** Add rate limit headers to responses
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1705234567
  ```

**Files:** `src/lib/rateLimit.ts`, `src/lib/featureFlags.ts`, `src/middleware.ts`

---

## Phase 2: High Priority Fixes (P1 - 1 Week)

### 2.1 Upgrade PIN Authentication Security

**Risk:** 4-digit PIN with SHA-256 (no salt) can be brute-forced in minutes.

- [ ] **2.1.1** Implement Argon2id password hashing
  ```bash
  npm install argon2
  ```
  ```typescript
  // src/lib/auth.ts
  import argon2 from 'argon2';

  export async function hashPin(pin: string, userId: string): Promise<string> {
    return argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MB
      timeCost: 3,
      parallelism: 4,
      salt: Buffer.from(userId),  // Per-user salt
    });
  }

  export async function verifyPin(pin: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, pin);
  }
  ```

- [ ] **2.1.2** Migrate existing SHA-256 hashes to Argon2
  ```typescript
  // Migration strategy: verify with old hash, rehash on successful login
  const isValidSha256 = await verifySha256Pin(pin, user.pin_hash);
  if (isValidSha256) {
    const newHash = await hashPin(pin, user.id);
    await supabase.from('users').update({ pin_hash: newHash }).eq('id', user.id);
  }
  ```

- [ ] **2.1.3** Implement server-side lockout with Redis
  ```typescript
  const lockoutKey = `lockout:${userId}`;
  const attempts = await redis.incr(lockoutKey);
  await redis.expire(lockoutKey, 900);  // 15-minute window

  if (attempts > 5) {
    throw new Error('Account temporarily locked. Try again in 15 minutes.');
  }
  ```

- [ ] **2.1.4** Consider upgrading to 6-digit PIN or requiring alphanumeric password

**Files:** `src/lib/auth.ts`, `src/components/LoginScreen.tsx`

---

### 2.2 Implement Secure Session Management

**Risk:** localStorage sessions are vulnerable to XSS and never expire.

- [ ] **2.2.1** Create `user_sessions` table
  ```sql
  CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,  -- SHA-256 of session token
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE
  );

  CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
  CREATE INDEX idx_sessions_user ON user_sessions(user_id);
  ```

- [ ] **2.2.2** Generate cryptographically secure session tokens
  ```typescript
  import { randomBytes, createHash } from 'crypto';

  export function generateSessionToken(): string {
    return randomBytes(32).toString('base64url');
  }

  export function hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  ```

- [ ] **2.2.3** Implement session timeout (30 minutes idle, 8 hours max)
  ```typescript
  const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000;  // 30 minutes
  const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;   // 8 hours
  ```

- [ ] **2.2.4** Store session token in HttpOnly cookie (not localStorage)
  ```typescript
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE / 1000,
    path: '/',
  });
  ```

- [ ] **2.2.5** Add session validation to middleware
- [ ] **2.2.6** Implement session revocation on logout

**Files:** `src/lib/auth.ts`, `src/middleware.ts`, New migration file

---

### 2.3 Add Security Headers

**Risk:** Missing headers expose app to clickjacking, XSS, MIME sniffing attacks.

- [ ] **2.3.1** Add comprehensive security headers in `next.config.ts`
  ```typescript
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(self), geolocation=()',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.openai.com; frame-ancestors 'none';",
        },
      ],
    },
  ],
  ```

- [ ] **2.3.2** Test CSP doesn't break functionality
- [ ] **2.3.3** Add report-uri for CSP violations (optional)

**Files:** `next.config.ts`

---

### 2.4 Sanitize AI Prompt Inputs

**Risk:** Prompt injection via malicious email content could extract data or manipulate AI behavior.

- [ ] **2.4.1** Create prompt sanitization utility
  ```typescript
  // src/lib/promptSanitizer.ts
  export function sanitizePromptInput(input: string): string {
    return input
      // Remove potential prompt injection patterns
      .replace(/ignore previous instructions/gi, '[FILTERED]')
      .replace(/disregard above/gi, '[FILTERED]')
      .replace(/system:/gi, '[FILTERED]')
      .replace(/assistant:/gi, '[FILTERED]')
      // Limit length
      .substring(0, 10000)
      // Escape XML/HTML-like content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  ```

- [ ] **2.4.2** Apply sanitization to all AI endpoints
  ```typescript
  const sanitizedBody = sanitizePromptInput(body);
  const sanitizedSubject = sanitizePromptInput(subject);
  ```

- [ ] **2.4.3** Use Claude's built-in prompt safety features
  ```typescript
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: userInput,
          cache_control: { type: 'ephemeral' },  // Prevents caching of untrusted input
        },
      ],
    },
  ],
  ```

- [ ] **2.4.4** Add input length limits to AI endpoints

**Files:** All files in `src/app/api/ai/*/route.ts`, New file `src/lib/promptSanitizer.ts`

---

### 2.5 Implement CSRF Protection

**Risk:** Cross-site request forgery could allow attackers to create tasks, send messages, or modify data.

- [ ] **2.5.1** Generate CSRF tokens per session
  ```typescript
  export function generateCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }
  ```

- [ ] **2.5.2** Store CSRF token in session and cookie
  ```typescript
  response.cookies.set('csrf', csrfToken, {
    httpOnly: false,  // Needs to be readable by JavaScript
    secure: true,
    sameSite: 'strict',
  });
  ```

- [ ] **2.5.3** Validate CSRF token on state-changing requests (POST, PUT, DELETE)
  ```typescript
  const csrfHeader = request.headers.get('X-CSRF-Token');
  const csrfCookie = request.cookies.get('csrf');

  if (csrfHeader !== csrfCookie?.value) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  ```

- [ ] **2.5.4** Add CSRF token to all fetch requests in frontend
  ```typescript
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf='))
    ?.split('=')[1];

  fetch('/api/todos', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
  ```

**Files:** `src/middleware.ts`, `src/lib/csrf.ts` (new), Update all API calls

---

## Phase 3: Medium Priority Fixes (P2 - 2 Weeks)

### 3.1 Implement Database-Level Audit Logging

**Risk:** Application-level logging can be bypassed if attacker accesses database directly.

- [ ] **3.1.1** Create audit log table
  ```sql
  CREATE TABLE security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    user_id UUID,
    user_name TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Partition by month for performance
  CREATE INDEX idx_audit_log_time ON security_audit_log(created_at);
  CREATE INDEX idx_audit_log_user ON security_audit_log(user_id);
  CREATE INDEX idx_audit_log_table ON security_audit_log(table_name);
  ```

- [ ] **3.1.2** Create audit trigger function
  ```sql
  CREATE OR REPLACE FUNCTION audit_trigger_function()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO security_audit_log (
      event_type, table_name, record_id, user_name,
      old_data, new_data
    ) VALUES (
      TG_OP, TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      current_setting('app.current_user_name', true),
      CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;
  ```

- [ ] **3.1.3** Apply triggers to sensitive tables
  ```sql
  CREATE TRIGGER audit_todos AFTER INSERT OR UPDATE OR DELETE ON todos
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

  CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

  CREATE TRIGGER audit_messages AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
  ```

- [ ] **3.1.4** Set up log retention policy (90 days recommended)

**Files:** New migration file

---

### 3.2 Implement Secret Rotation Mechanism

**Risk:** Static API keys never expire, increasing window for compromise.

- [ ] **3.2.1** Document all secrets requiring rotation:
  - `OUTLOOK_ADDON_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `UPSTASH_REDIS_REST_TOKEN`

- [ ] **3.2.2** Create secret rotation runbook
  ```markdown
  ## Secret Rotation Procedure
  1. Generate new secret in provider console
  2. Add new secret to Railway as secondary env var
  3. Update code to accept both old and new secrets
  4. Deploy with dual-secret support
  5. Update primary env var to new secret
  6. Remove old secret from provider
  7. Remove dual-secret code after 24h
  ```

- [ ] **3.2.3** Set calendar reminders for 90-day rotation
- [ ] **3.2.4** Consider integrating with HashiCorp Vault or AWS Secrets Manager

**Files:** Documentation only

---

### 3.3 Remove Dangerous HTML Patterns

**Risk:** `dangerouslySetInnerHTML` can enable XSS if user input is ever passed through.

- [ ] **3.3.1** Audit all uses of `dangerouslySetInnerHTML`
  ```bash
  grep -r "dangerouslySetInnerHTML" src/
  ```

- [ ] **3.3.2** Replace with React components
  ```typescript
  // BEFORE
  <span dangerouslySetInnerHTML={{
    __html: text.replace(/"([^"]+)"/g, '<strong>"$1"</strong>')
  }} />

  // AFTER
  function HighlightQuotes({ text }: { text: string }) {
    const parts = text.split(/(".*?")/g);
    return (
      <span>
        {parts.map((part, i) =>
          part.startsWith('"') ? <strong key={i}>{part}</strong> : part
        )}
      </span>
    );
  }
  ```

- [ ] **3.3.3** If HTML rendering is required, use DOMPurify
  ```bash
  npm install dompurify @types/dompurify
  ```
  ```typescript
  import DOMPurify from 'dompurify';

  const sanitizedHtml = DOMPurify.sanitize(userInput);
  ```

**Files:** `src/app/outlook-setup/page.tsx`

---

### 3.4 Implement File Content Scanning

**Risk:** Malicious files (malware, XSS in SVG) can be uploaded.

- [ ] **3.4.1** Remove SVG from allowed file types (XSS vector)
  ```typescript
  // src/types/todo.ts
  const ALLOWED_UPLOAD_TYPES = {
    // Remove: 'svg': 'image/svg+xml',
    ...
  };
  ```

- [ ] **3.4.2** Add file type verification by magic bytes
  ```typescript
  import { fileTypeFromBuffer } from 'file-type';

  const buffer = await file.arrayBuffer();
  const type = await fileTypeFromBuffer(Buffer.from(buffer));

  if (!type || !ALLOWED_MIME_TYPES.includes(type.mime)) {
    throw new Error('Invalid file type');
  }
  ```

- [ ] **3.4.3** Consider integrating with malware scanning API (ClamAV, VirusTotal)
- [ ] **3.4.4** Implement file size limits per user (total storage quota)

**Files:** `src/app/api/attachments/route.ts`, `src/types/todo.ts`

---

### 3.5 Reduce Production Logging

**Risk:** Excessive logging may expose sensitive data in Railway logs.

- [ ] **3.5.1** Create structured logger utility
  ```typescript
  // src/lib/logger.ts
  const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = process.env.LOG_LEVEL || 'info';

  export const logger = {
    debug: (msg: string, data?: object) => {
      if (LOG_LEVELS.debug >= LOG_LEVELS[currentLevel]) {
        console.log(JSON.stringify({ level: 'debug', msg, ...sanitizeLogData(data) }));
      }
    },
    // ... info, warn, error
  };

  function sanitizeLogData(data?: object): object {
    if (!data) return {};
    // Remove sensitive fields
    const { pin, password, token, apiKey, ...safe } = data as any;
    return safe;
  }
  ```

- [ ] **3.5.2** Replace console.log with structured logger
- [ ] **3.5.3** Set `LOG_LEVEL=warn` in production
- [ ] **3.5.4** Never log full request/response bodies

**Files:** New file `src/lib/logger.ts`, All API routes

---

### 3.6 Implement Per-User Upload Quotas

**Risk:** Single user can exhaust storage by uploading unlimited files.

- [ ] **3.6.1** Add storage tracking columns
  ```sql
  ALTER TABLE users ADD COLUMN storage_used_bytes BIGINT DEFAULT 0;
  ALTER TABLE users ADD COLUMN storage_quota_bytes BIGINT DEFAULT 104857600;  -- 100MB
  ```

- [ ] **3.6.2** Update upload logic to check quota
  ```typescript
  const { data: user } = await supabase
    .from('users')
    .select('storage_used_bytes, storage_quota_bytes')
    .eq('name', uploadedBy)
    .single();

  if (user.storage_used_bytes + fileSize > user.storage_quota_bytes) {
    return NextResponse.json(
      { error: 'Storage quota exceeded' },
      { status: 413 }
    );
  }
  ```

- [ ] **3.6.3** Update storage usage on upload/delete
- [ ] **3.6.4** Create admin UI to view/adjust quotas

**Files:** `src/app/api/attachments/route.ts`, New migration file

---

## Phase 4: Best Practice Improvements (P3 - 4 Weeks)

### 4.1 Implement OAuth 2.0 Login (Google/Microsoft)

**Benefit:** Leverage enterprise identity providers, eliminate PIN management.

- [ ] **4.1.1** Enable OAuth feature flag
  ```
  NEXT_PUBLIC_ENABLE_OAUTH=true
  ```

- [ ] **4.1.2** Configure Google OAuth credentials
- [ ] **4.1.3** Configure Microsoft/Azure AD OAuth credentials
- [ ] **4.1.4** Link OAuth identities to existing users
- [ ] **4.1.5** Implement gradual migration from PIN to OAuth

**Files:** `src/components/OAuthLoginButtons.tsx`, NextAuth configuration

---

### 4.2 Implement Owner Role Check from Database

**Risk:** Hardcoded `userName === 'Derrick'` is fragile and insecure.

- [ ] **4.2.1** Add role column to users table
  ```sql
  ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member'));
  UPDATE users SET role = 'owner' WHERE name = 'Derrick';
  ```

- [ ] **4.2.2** Update isOwner checks
  ```typescript
  // BEFORE
  const isOwner = currentUser?.name === 'Derrick';

  // AFTER
  const isOwner = currentUser?.role === 'owner';
  ```

- [ ] **4.2.3** Add role-based access to RLS policies

**Files:** `src/components/MainApp.tsx`, New migration file

---

### 4.3 Implement Security Scanning in CI/CD

**Benefit:** Catch vulnerabilities before deployment.

- [ ] **4.3.1** Add dependency scanning
  ```yaml
  # .github/workflows/security.yml
  - name: Check for vulnerabilities
    run: npm audit --audit-level=high
  ```

- [ ] **4.3.2** Add static code analysis (Semgrep or SonarQube)
- [ ] **4.3.3** Add secret scanning (git-secrets, trufflehog)
- [ ] **4.3.4** Add container image scanning (Trivy)

**Files:** New workflow file

---

### 4.4 Implement Content Security Policy Reporting

**Benefit:** Monitor for XSS attempts and CSP violations.

- [ ] **4.4.1** Set up CSP report endpoint
  ```typescript
  // src/app/api/csp-report/route.ts
  export async function POST(request: NextRequest) {
    const report = await request.json();
    console.warn('CSP Violation:', report);
    // Log to monitoring service
    return NextResponse.json({ received: true });
  }
  ```

- [ ] **4.4.2** Add report-uri to CSP header
  ```
  Content-Security-Policy: ...; report-uri /api/csp-report
  ```

- [ ] **4.4.3** Monitor reports for patterns

**Files:** `next.config.ts`, New API route

---

### 4.5 Implement Data Classification

**Benefit:** Identify and protect sensitive fields appropriately.

- [ ] **4.5.1** Document data classification levels
  ```markdown
  ## Data Classification

  ### CONFIDENTIAL (Requires Encryption)
  - users.pin_hash
  - messages.text (may contain PII)
  - todos.notes (may contain customer info)
  - todos.transcription (voicemail content)

  ### INTERNAL (Requires Access Control)
  - todos.* (all task data)
  - strategic_goals.* (business strategy)

  ### PUBLIC
  - goal_categories.* (category names/colors)
  ```

- [ ] **4.5.2** Implement field-level encryption for CONFIDENTIAL data
- [ ] **4.5.3** Add data masking for logs and exports

**Files:** Documentation, potentially encryption utilities

---

### 4.6 Conduct Penetration Testing

**Benefit:** Validate security controls with professional assessment.

- [ ] **4.6.1** Engage third-party penetration testing firm
- [ ] **4.6.2** Scope: Authentication, API security, data access
- [ ] **4.6.3** Remediate findings
- [ ] **4.6.4** Retest after remediation
- [ ] **4.6.5** Document for Allstate compliance records

**Files:** External engagement

---

## Compliance Checklist

### Allstate Information Security Requirements

- [ ] **Access Control:** User authentication with lockout after failed attempts
- [ ] **Data Protection:** Encryption at rest and in transit (Supabase provides)
- [ ] **Audit Logging:** All data access and modifications logged
- [ ] **Incident Response:** Security contact and escalation path documented
- [ ] **Vendor Management:** Third-party services (Anthropic, OpenAI) documented
- [ ] **Data Retention:** Retention policies defined and enforced
- [ ] **Business Continuity:** Backup and recovery procedures documented

### NAIC Model Laws Compliance

- [ ] **Consumer Privacy:** PII handling procedures documented
- [ ] **Data Breach Notification:** Incident response plan includes notification
- [ ] **Third-Party Security:** Vendor security assessments on file

---

## Security Contacts

| Role | Name | Contact |
|------|------|---------|
| Application Owner | Derrick Bealer | [internal] |
| Security Lead | [TBD] | [TBD] |
| Incident Response | [TBD] | [TBD] |

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-14 | 1.0 | Initial security assessment | Claude |

---

## Appendix A: Security Testing Commands

```bash
# Check for known vulnerabilities in dependencies
npm audit

# Check for outdated packages
npm outdated

# Run security linting
npx eslint --config eslint.config.mjs src/ --rule '{"no-eval": "error"}'

# Scan for secrets in git history
npx trufflehog git file://. --only-verified

# Test CORS configuration
curl -H "Origin: https://evil.com" -I https://your-app.railway.app/api/outlook/users

# Test rate limiting
for i in {1..20}; do curl -X POST https://your-app.railway.app/api/ai/smart-parse; done
```

---

## Appendix B: Environment Variables Security Checklist

| Variable | Sensitive | Rotation Required | Current State |
|----------|-----------|-------------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | No | Safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Yearly | Safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | Quarterly | **Review Usage** |
| `ANTHROPIC_API_KEY` | **YES** | Quarterly | Secure |
| `OPENAI_API_KEY` | **YES** | Quarterly | Secure |
| `OUTLOOK_ADDON_API_KEY` | **YES** | Quarterly | Secure |
| `UPSTASH_REDIS_REST_TOKEN` | **YES** | Quarterly | Secure |

---

*This checklist should be reviewed monthly and updated as security requirements evolve.*
