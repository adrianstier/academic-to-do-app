# Codebase Cleanup & Implementation Plan

**Generated:** 2026-01-13
**Codebase Stats:** 26,917 lines of source code | 32+ components | 19 API routes

---

## Executive Summary

This document outlines the cleanup tasks and implementation priorities for the shared-todo-list codebase. The project is well-structured but has accumulated technical debt, redundant documentation, and some unused code that should be addressed.

---

## 1. Files to DELETE (Safe to Remove)

These files add no value and should be deleted:

### Redundant Documentation (Root Level)
| File | Reason | Action |
|------|--------|--------|
| `DEPLOYMENT_COMPLETE.md` | Outdated status document | DELETE |
| `DEPLOYMENT_FIX.md` | One-time fix instructions | DELETE |
| `DEPLOYMENT_STEPS.md` | Duplicate of DEPLOYMENT_GUIDE.md | DELETE |
| `DEPLOY_NOW.md` | Urgent one-time instructions | DELETE |
| `APPLY_SECURITY_FIX.md` | One-time security fix | DELETE |
| `SECURITY_FIX_SUMMARY.md` | Historical, no longer needed | DELETE |
| `IMPLEMENTATION_SUMMARY.md` | Captured in CLAUDE.md | DELETE |
| `EMAIL_FEATURE_TESTING_SUMMARY.md` | Test results (outdated) | DELETE |
| `DEPLOYMENT_CHECKLIST.txt` | Duplicate content | DELETE |
| `RAILWAY_ENV_VARS_SUMMARY.txt` | Captured in .env.example | DELETE |

### Development Artifacts
| File/Directory | Reason | Action |
|----------------|--------|--------|
| `coverage/` | Generated test coverage (876KB) | Add to .gitignore, DELETE |
| `test-results/` | Playwright artifacts (624KB) | Add to .gitignore, DELETE |
| `tsconfig.tsbuildinfo` | Build cache | Add to .gitignore, DELETE |
| `playwright.config.local.ts` | Local config | Add to .gitignore or DELETE |

### Utility Scripts (Move or Delete)
| File | Reason | Action |
|------|--------|--------|
| `check-page.mjs` | Unclear purpose | DELETE or document |
| `apply-migration.mjs` | Should be in scripts/ | MOVE to scripts/ |

**Estimated cleanup:** ~1.5MB disk space, 10 fewer root files

---

## 2. Files to CONSOLIDATE

### Documentation Consolidation

**Keep these 6 essential docs:**
1. `README.md` - Project overview
2. `SETUP.md` - Installation instructions
3. `CLAUDE.md` - AI assistant guide (comprehensive)
4. `DEPLOYMENT_GUIDE.md` - Production deployment
5. `REFACTORING_PLAN.md` - Technical roadmap
6. `PRD.md` - Product requirements

**Merge into DEPLOYMENT_GUIDE.md:**
- `OAUTH_DEPLOYMENT_GUIDE.md` - Add as "OAuth Setup" section
- `OAUTH_EMAIL_WHITELIST.md` - Add as "Email Whitelist" section

**Archive or delete:**
- `WHATS_NEW.md` - Move to CHANGELOG.md or delete
- `DESIGN_SPEC_LIST_VIEW.md` - Archive in docs/ folder

---

## 3. Code Cleanup Tasks

### Priority 1: Critical (Do Now)

#### A. Remove Console Statements (30+ instances)
Replace `console.log/error` with centralized logger:

```typescript
// Before
console.error('Failed to fetch goals:', error);

// After
import { logger } from '@/lib/logger';
logger.error('Failed to fetch goals', { error });
```

**Files to update:**
- `src/app/api/goals/route.ts` (5 instances)
- `src/app/api/goals/categories/route.ts` (4 instances)
- `src/app/api/ai/smart-parse/route.ts` (2 instances)
- `src/app/api/ai/parse-file/route.ts` (2 instances)
- `src/app/outlook-setup/page.tsx` (2 instances)
- + ~15 other files

#### B. Fix @ts-ignore Comment
Location: `src/app/api/auth/[...nextauth]/route.ts`
Action: Properly type or add explanation comment

#### C. Standardize Supabase Imports
Current state: 8 different import patterns
Target: Single consistent pattern

```typescript
// Standardize to:
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// For API routes needing service role:
import { createServiceClient } from '@/lib/supabase';
```

### Priority 2: High (This Week)

#### D. Update .gitignore
Add these entries:
```gitignore
# Test artifacts
coverage/
test-results/
playwright-report/

# Build cache
tsconfig.tsbuildinfo
*.tsbuildinfo

# Local configs
playwright.config.local.ts
.env.local
```

#### E. Clean Up Unused Dependencies
Evaluate and potentially remove:
- `@sentry/nextjs` - Currently 80% unused, either fully implement or remove
- Verify `@upstash/redis` and `@upstash/ratelimit` are actually used

#### F. Move Utility Scripts
```bash
mv apply-migration.mjs scripts/
rm check-page.mjs  # or document its purpose
```

### Priority 3: Medium (This Sprint)

#### G. Component Performance Optimization
Add `useMemo`/`useCallback` to large components:
- `TodoList.tsx` (2,664 lines) - filter/sort memoization
- `ChatPanel.tsx` (2,080 lines) - message list memoization
- `KanbanBoard.tsx` (1,528 lines) - column memoization

#### H. Sentry Integration
Either fully implement or remove:
- Add error boundary with Sentry capture
- Add breadcrumb tracking
- Or remove dependency (-500KB bundle size)

---

## 4. Architecture Improvements (Future)

### Component Refactoring (Per REFACTORING_PLAN.md)

**TodoList.tsx (2,664 lines) should become:**
```
src/components/tasks/
├── TaskList.tsx           # Main container
├── TaskFilters.tsx        # Filter controls
├── TaskSort.tsx           # Sort controls
├── TaskBulkActions.tsx    # Bulk operations
├── TaskListView.tsx       # List rendering
└── hooks/
    ├── useTaskFilters.ts
    └── useTaskSort.ts
```

**ChatPanel.tsx (2,080 lines) should become:**
```
src/components/chat/
├── ChatPanel.tsx          # Main container
├── MessageList.tsx        # Message rendering
├── MessageInput.tsx       # Input + voice
├── MessageItem.tsx        # Single message
├── ChatPresence.tsx       # Online users
└── hooks/
    ├── useMessages.ts
    └── usePresence.ts
```

---

## 5. Immediate Action Checklist

### Today (15 minutes)
- [ ] Delete redundant markdown files (10 files)
- [ ] Update .gitignore
- [ ] Delete coverage/ and test-results/ directories

### This Week (2-3 hours)
- [ ] Replace console.log with logger (30+ instances)
- [ ] Fix @ts-ignore comment
- [ ] Standardize Supabase imports
- [ ] Move apply-migration.mjs to scripts/
- [ ] Consolidate OAuth docs into DEPLOYMENT_GUIDE.md

### This Sprint (8-10 hours)
- [ ] Audit Sentry integration - implement or remove
- [ ] Add memoization to large components
- [ ] Create CHANGELOG.md from WHATS_NEW.md
- [ ] Archive design specs to docs/ folder

---

## 6. Risk Assessment

| Task | Risk | Mitigation |
|------|------|------------|
| Delete markdown files | Low | Content preserved in CLAUDE.md |
| Console → logger | Low | Search/replace, test coverage exists |
| Supabase imports | Medium | Gradual migration, test each file |
| Remove Sentry | Medium | Ensure no production dependencies |
| Component refactor | High | Feature flags, gradual rollout |

---

## 7. Success Metrics

After cleanup:
- [ ] Root directory: 6 markdown files (down from 18)
- [ ] Zero console.log statements in src/
- [ ] .gitignore covers all generated files
- [ ] Single Supabase import pattern
- [ ] Bundle size reduced by ~500KB (if Sentry removed)

---

## Appendix: Current File Inventory

### Root Directory (Current: 44 items)
```
Essential (Keep):
- README.md, SETUP.md, CLAUDE.md, PRD.md
- DEPLOYMENT_GUIDE.md, REFACTORING_PLAN.md
- package.json, tsconfig.json, next.config.ts
- Dockerfile, railway.json
- eslint.config.mjs, vitest.config.ts, playwright.config.ts
- postcss.config.mjs, sentry.*.config.ts (3 files)
- .env.example, .gitignore, .node-version

Delete/Archive:
- 10 redundant markdown files
- 2 text files (checklist, env vars)
- 2 utility scripts (check-page, apply-migration)
- 1 local config (playwright.config.local.ts)
- 3 directories (coverage, test-results, .next build cache)

Target: ~30 items (32% reduction)
```

---

**Document Version:** 1.0
**Next Review:** After initial cleanup complete
