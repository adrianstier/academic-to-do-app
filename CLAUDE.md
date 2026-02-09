# Academic Project Manager

Real-time collaborative task management platform for academic and research teams. Features AI-powered workflows, team chat, strategic planning, and Outlook integration.

## Stack
- Next.js (App Router) + TypeScript
- Supabase (auth, database, real-time, RLS)
- Tailwind CSS + shadcn/ui
- Vitest (unit) + Playwright (E2E)

## Commands
```
npm run dev              # Dev server
npm run build            # Production build
npm run test             # Unit tests
npm run test:e2e         # E2E tests
npm run test:coverage    # Coverage report
npm run migrate:schema   # Database migrations
npm run migrate:dry-run  # Preview migrations
```

## Directory Structure
- `src/app/` — Next.js App Router pages + API routes
  - `api/` — Backend endpoints
  - `join/`, `signup/` — Auth flows
- `src/components/` — React components by domain
  - `chat/` — Team messaging
  - `dashboard/` — Dashboard widgets
  - `todo/` — Task lists
  - `task-detail/` — Task detail views
  - `TeamManagement/` — Team/permissions management
  - `views/` — List/board/calendar views
  - `layout/` — App shell and navigation
  - `ui/` — Shared shadcn/ui primitives
- `src/lib/` — Business logic and utilities
  - `db/` — Database helpers
- `src/hooks/` — Custom React hooks
- `src/store/` — State management
- `src/contexts/` — React context providers
- `src/types/` — TypeScript types
- `tests/` — Playwright E2E tests
- `docs/` — Architecture and feature docs
- `scripts/` — Migration utilities

## Conventions
- App Router with server components where possible
- API routes use Supabase auth middleware
- RLS policies enforce data isolation
- Environment variables in `.env.local` (see backup `.json` files for reference data)

## File Ownership (parallel work)
- `src/components/chat/` — chat feature, independent
- `src/components/dashboard/` — dashboard, independent
- `src/components/todo/` — task management, independent
- `src/components/TeamManagement/` — team features, independent
- `src/app/api/` — API routes by domain, splittable
- `src/lib/` — shared utilities, coordinate edits
- `tests/` — each spec file is independent
- `docs/` — independent files

## Gotchas
- Closely related to `shared-todo-list` repo (sibling project, similar architecture)
- Supabase RLS is critical — always verify data isolation after API changes
- Many root-level `.md` files are planning/status artifacts
- Dockerfile exists but check if Docker deployment is active
