# Orchestrator Context Guide

This document provides structured context for AI orchestrator agents working on the Shared Todo List codebase. It's designed for quick parsing and reliable decision-making.

---

## Quick Facts

| Property | Value |
|----------|-------|
| **App Name** | Bealer Agency Shared Todo List |
| **Purpose** | Collaborative task management for insurance agency |
| **Primary Users** | Derrick (owner), Sefra (team member) |
| **Stack** | Next.js 16 + React 19 + TypeScript + Supabase + Tailwind |
| **Database** | PostgreSQL (Supabase) |
| **AI Services** | Anthropic Claude, OpenAI Whisper |
| **Deployment** | Railway (Docker) |
| **Real-time** | Supabase WebSocket subscriptions |

---

## Directory Structure

```
shared-todo-list/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Entry point (auth + app shell)
│   │   ├── layout.tsx         # Root layout with providers
│   │   ├── globals.css        # Global styles
│   │   └── api/               # API Routes (17 endpoints)
│   │       ├── ai/            # 8 AI endpoints
│   │       ├── outlook/       # 3 Outlook integration endpoints
│   │       ├── goals/         # Strategic goals CRUD
│   │       ├── templates/     # Task templates CRUD
│   │       ├── activity/      # Activity logging
│   │       ├── attachments/   # File uploads
│   │       └── patterns/      # Task pattern analysis
│   ├── components/            # 47 React components
│   │   ├── MainApp.tsx       # Main authenticated shell
│   │   ├── TodoList.tsx      # Task list view
│   │   ├── TodoItem.tsx      # Individual task component
│   │   ├── KanbanBoard.tsx   # Kanban view
│   │   ├── ChatPanel.tsx     # Team chat (2,062 lines)
│   │   ├── Dashboard.tsx     # Analytics dashboard
│   │   ├── StrategicDashboard.tsx  # Owner-only goals
│   │   ├── ActivityFeed.tsx  # Audit log display
│   │   └── todo/             # Modular todo components
│   ├── hooks/                 # 8 custom React hooks
│   │   ├── useTodoData.ts    # Todo fetching & mutations
│   │   ├── useFilters.ts     # Filter state management
│   │   ├── useBulkActions.ts # Multi-select operations
│   │   └── useTodoModals.ts  # Modal state management
│   ├── lib/                   # 19 utility modules
│   │   ├── supabaseClient.ts # Database client
│   │   ├── auth.ts           # PIN authentication
│   │   ├── activityLogger.ts # Audit logging
│   │   ├── duplicateDetection.ts  # Duplicate task detection
│   │   ├── fileValidator.ts  # Upload security
│   │   ├── featureFlags.ts   # Feature toggles
│   │   └── db/todoService.ts # Database operations
│   ├── store/                 # State management
│   │   └── todoStore.ts      # Zustand store
│   ├── contexts/              # React contexts
│   │   └── ThemeContext.tsx  # Dark mode
│   └── types/                 # TypeScript definitions
│       └── todo.ts           # All data types
├── ios-app/                   # Native iOS app (Swift)
├── supabase/
│   ├── migrations/           # SQL schema migrations
│   └── functions/            # Edge functions
├── tests/                     # Test files
│   ├── unit/                 # Unit tests (Vitest)
│   ├── integration/          # Integration tests
│   └── e2e/                  # E2E tests (Playwright)
├── scripts/                   # Utility scripts
├── docs/                      # Additional documentation
├── CLAUDE.md                  # Detailed developer guide
├── PRD.md                     # Product requirements
└── package.json              # Dependencies
```

---

## Data Models

### Primary Entities

#### Todo (Task)
```typescript
interface Todo {
  id: string;                    // UUID
  text: string;                  // Task description
  completed: boolean;            // Completion status
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;            // ISO timestamp
  created_by: string;            // User name
  assigned_to: string | null;    // User name or null
  due_date: string | null;       // ISO timestamp
  notes: string | null;          // Additional notes
  recurrence: 'daily' | 'weekly' | 'monthly' | null;
  subtasks: Subtask[];           // JSONB array
  attachments: Attachment[];     // JSONB array
  transcription: string | null;  // Voice memo text
  merged_from: string[];         // IDs of merged tasks
  updated_at: string;
  updated_by: string | null;
}
```

#### Subtask
```typescript
interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  estimatedMinutes?: number;
}
```

#### Attachment
```typescript
interface Attachment {
  id: string;
  file_name: string;
  file_type: 'pdf' | 'image' | 'audio' | 'video' | 'document' | 'archive';
  file_size: number;             // bytes (max 25MB)
  mime_type: string;
  storage_path: string;          // Supabase storage path
  uploaded_by: string;
  uploaded_at: string;
}
// Max 10 attachments per task
```

#### User
```typescript
interface User {
  id: string;
  name: string;                  // Unique username
  pin_hash: string;              // SHA-256 hash
  color: string;                 // Hex color for UI
  created_at: string;
  last_login: string | null;
  streak_count: number;          // Login streak
  streak_last_date: string | null;
  welcome_shown_at: string | null;
}
```

#### ChatMessage
```typescript
interface ChatMessage {
  id: string;
  text: string;
  created_by: string;
  created_at: string;
  recipient: string | null;      // null = team chat, name = DM
  related_todo_id: string | null;
  reactions: Reaction[];         // JSONB
  read_by: string[];             // User names
  reply_to_id: string | null;    // Threading
  reply_to_text: string | null;
  reply_to_user: string | null;
  edited_at: string | null;
  deleted_at: string | null;     // Soft delete
  is_pinned: boolean;
  pinned_by: string | null;
  mentions: string[];            // @mentioned users
}

type ReactionType = 'heart' | 'thumbsup' | 'thumbsdown' | 'haha' | 'exclamation' | 'question';
```

#### ActivityLogEntry
```typescript
interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  todo_id: string | null;
  todo_text: string | null;
  user_name: string;
  details: Record<string, unknown>;  // { from: x, to: y }
  created_at: string;
}

type ActivityAction =
  | 'task_created' | 'task_updated' | 'task_deleted'
  | 'task_completed' | 'task_reopened'
  | 'status_changed' | 'priority_changed'
  | 'assigned_to_changed' | 'due_date_changed'
  | 'subtask_added' | 'subtask_completed' | 'subtask_deleted'
  | 'notes_updated'
  | 'template_created' | 'template_used'
  | 'attachment_added' | 'attachment_removed'
  | 'tasks_merged';
```

#### TaskTemplate
```typescript
interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  default_priority: Priority;
  default_assigned_to: string | null;
  subtasks: TemplateSubtask[];
  created_by: string;
  is_shared: boolean;            // Team-visible or private
  created_at: string;
  updated_at: string;
}
```

#### StrategicGoal (Owner Only)
```typescript
interface StrategicGoal {
  id: string;
  title: string;
  description: string | null;
  category_id: string;           // FK to goal_categories
  status: 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  target_date: string | null;
  target_value: string | null;   // e.g., "$1M revenue"
  current_value: string | null;
  progress_percent: number;      // 0-100
  notes: string | null;
  display_order: number;
  created_by: string;
  milestones: GoalMilestone[];
}

// 6 predefined categories:
// Revenue & Growth, Client Acquisition, Team Development,
// Operations, Marketing, Product Lines
```

---

## Database Schema

### Tables Overview

| Table | Purpose | Real-time |
|-------|---------|-----------|
| `users` | Team members with PIN auth | No |
| `todos` | Tasks with embedded JSONB | Yes |
| `messages` | Chat with reactions, threading | Yes |
| `activity_log` | Audit trail | Yes |
| `task_templates` | Saved task patterns | No |
| `device_tokens` | Push notification tokens | No |
| `strategic_goals` | Owner goals | Yes |
| `goal_categories` | Goal organization | No |
| `goal_milestones` | Goal sub-objectives | Yes |

### Key Relationships

```
users (1) ──────────────< (N) todos (created_by, assigned_to)
users (1) ──────────────< (N) messages (created_by)
todos (1) ──────────────< (N) activity_log (todo_id)
todos (1) ──────────────< (N) messages (related_todo_id)
strategic_goals (1) ────< (N) goal_milestones (goal_id)
goal_categories (1) ────< (N) strategic_goals (category_id)
users (1) ──────────────< (N) device_tokens (user_id)
```

### Access Control

- **RLS Status**: Permissive (all-allow policies)
- **Access Control**: Application-level, not database-level
- **Owner Check**: `currentUser?.name === 'Derrick'`

---

## API Endpoints

### AI Endpoints (`/api/ai/*`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/smart-parse` | POST | Natural language → task + subtasks |
| `/api/ai/enhance-task` | POST | Improve task clarity, extract metadata |
| `/api/ai/breakdown-task` | POST | Generate subtasks for complex task |
| `/api/ai/transcribe` | POST | Audio → text (Whisper) |
| `/api/ai/parse-voicemail` | POST | Voicemail → actionable task |
| `/api/ai/parse-file` | POST | Document → extracted tasks |
| `/api/ai/parse-content-to-subtasks` | POST | Bullet points → subtasks |
| `/api/ai/generate-email` | POST | Tasks → customer email |

### Outlook Endpoints (`/api/outlook/*`)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/outlook/users` | GET | X-API-Key | List users for add-in |
| `/api/outlook/parse-email` | POST | X-API-Key | Email → task details |
| `/api/outlook/create-task` | POST | X-API-Key | Create task from Outlook |

### Data Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/templates` | GET/POST/DELETE | Template CRUD |
| `/api/activity` | GET/POST | Activity log |
| `/api/attachments` | POST | File upload |
| `/api/goals` | GET/POST/PUT/DELETE | Strategic goals |
| `/api/goals/categories` | GET/POST | Goal categories |
| `/api/goals/milestones` | GET/POST | Goal milestones |
| `/api/patterns/analyze` | GET/POST | Task pattern analysis |
| `/api/patterns/suggestions` | GET | Pattern-based suggestions |

---

## State Management

### Zustand Store (`src/store/todoStore.ts`)

```typescript
interface TodoStore {
  // Core Data
  todos: Todo[];
  users: string[];
  usersWithColors: { name: string; color: string }[];
  loading: boolean;
  connected: boolean;
  error: string | null;

  // Filters
  filters: {
    searchQuery: string;
    quickFilter: 'all' | 'today' | 'overdue' | 'high-priority';
    sortOption: 'urgency' | 'priority' | 'due_date' | 'created' | 'alphabetical' | 'custom';
    showCompleted: boolean;
    highPriorityOnly: boolean;
    statusFilter: Status | 'all';
    assignedToFilter: string | 'all';
    customerFilter: string | '';
    hasAttachmentsFilter: boolean;
    dateRangeFilter: { start: Date; end: Date } | null;
  };

  // Bulk Actions
  selectedTodos: Set<string>;
  showBulkActions: boolean;

  // UI State
  viewMode: 'list' | 'kanban';
  showAdvancedFilters: boolean;
  showCelebration: boolean;
  showProgressSummary: boolean;
  showWelcomeBack: boolean;
  showWeeklyChart: boolean;
  showShortcuts: boolean;
  showActivityFeed: boolean;
  showStrategicDashboard: boolean;
  showArchiveView: boolean;
  showMergeModal: boolean;
  showDuplicateModal: boolean;
  showEmailModal: boolean;
}
```

### Key Selectors

```typescript
selectFilteredTodos(): Todo[]     // Apply all filters + sort
selectTodoStats(): {              // Computed statistics
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  urgent: number;
}
```

---

## Component Architecture

### Main Component Tree

```
page.tsx (auth gate)
├── LoginScreen (unauthenticated)
└── MainApp (authenticated)
    ├── Header (UserSwitcher, navigation)
    ├── Dashboard (stats, charts)
    ├── TodoList
    │   ├── AddTodo
    │   │   ├── SmartParseModal
    │   │   ├── TemplatePicker
    │   │   └── SaveTemplateModal
    │   ├── TodoItem (list view)
    │   │   ├── AttachmentList
    │   │   ├── DuplicateDetectionModal
    │   │   └── CustomerEmailModal
    │   └── KanbanBoard (kanban view)
    │       └── SortableTodoItem
    ├── ChatPanel
    ├── StrategicDashboard (owner only)
    ├── ActivityFeed
    └── Modals (Celebration, Shortcuts, etc.)
```

### Large Components (Consider Refactoring)

| Component | Lines | Notes |
|-----------|-------|-------|
| ChatPanel.tsx | 2,062 | Team chat, DMs, reactions, threading |
| StrategicDashboard.tsx | 1,463 | Goals management |
| TodoList.tsx | 1,200+ | Task list with filters |
| KanbanBoard.tsx | 800+ | Drag-and-drop board |
| Dashboard.tsx | 662 | Analytics display |

---

## Authentication

### PIN-Based Auth (Current)

```typescript
// Registration flow
1. User enters name + 4-digit PIN
2. Client hashes PIN: SHA-256(pin) → pin_hash
3. Store in users table with random color
4. Create session in localStorage

// Login flow
1. User selects from registered users
2. Enter 4-digit PIN
3. Client hashes and compares
4. On match: create session
5. Lockout: 3 failures → 30 seconds

// Session structure
{
  userId: string;
  userName: string;
  loginAt: string;  // ISO timestamp
}
```

### API Key Auth (Outlook)

```typescript
// Required header
X-API-Key: <OUTLOOK_ADDON_API_KEY>

// Verification
const apiKey = request.headers.get('X-API-Key');
if (apiKey !== process.env.OUTLOOK_ADDON_API_KEY) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Real-Time Patterns

### Subscription Pattern

```typescript
useEffect(() => {
  const channel = supabase
    .channel('todos-channel')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'todos' },
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            setTodos(prev => [payload.new as Todo, ...prev]);
            break;
          case 'UPDATE':
            setTodos(prev => prev.map(t =>
              t.id === payload.new.id ? payload.new as Todo : t
            ));
            break;
          case 'DELETE':
            setTodos(prev => prev.filter(t => t.id !== payload.old.id));
            break;
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

### Optimistic Update Pattern

```typescript
const handleComplete = async (id: string) => {
  // 1. Optimistic update (instant UI)
  setTodos(prev => prev.map(t =>
    t.id === id ? { ...t, completed: true } : t
  ));

  try {
    // 2. Persist to database
    await supabase.from('todos').update({ completed: true }).eq('id', id);
    // 3. Real-time syncs to other clients
  } catch (error) {
    // 4. Rollback on failure
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, completed: false } : t
    ));
  }
};
```

---

## Core Utilities

### Activity Logging (`src/lib/activityLogger.ts`)

```typescript
import { logActivity } from '@/lib/activityLogger';

await logActivity({
  action: 'task_completed',
  todo_id: todo.id,
  todo_text: todo.text,
  user_name: currentUser.name,
  details: { completedAt: new Date().toISOString() }
});
```

### Duplicate Detection (`src/lib/duplicateDetection.ts`)

```typescript
import { findPotentialDuplicates } from '@/lib/duplicateDetection';

const matches = findPotentialDuplicates(newTaskText, existingTodos);
// Returns: { todo: Todo, score: number, reasons: string[] }[]
// Threshold: 0.3

// Scoring:
// - Phone match: +0.5
// - Email match: +0.4
// - Name match: +0.3
// - Text similarity: +0.2 × similarity
```

### File Validation (`src/lib/fileValidator.ts`)

```typescript
import { validateFile } from '@/lib/fileValidator';

const result = await validateFile(file);
// Checks: magic bytes, dangerous signatures, SVG security
// Max size: 25MB
// Supported: PDF, Word, Excel, images, audio, video, archives
```

### Feature Flags (`src/lib/featureFlags.ts`)

```typescript
import { isFeatureEnabled } from '@/lib/featureFlags';

if (isFeatureEnabled('normalized_schema')) {
  // Use new relational tables
}

// Available flags:
// - normalized_schema
// - oauth_support
// - row_level_security
```

---

## Insurance-Specific Features

### Task Categories (10 types)

| Category | Frequency | Completion Rate |
|----------|-----------|-----------------|
| policy_review | 42% | 77% |
| follow_up | 40% | 75% |
| vehicle_add | 25% | 80% |
| payment | 18% | 100% |
| endorsement | 18% | 71% |
| claim | 10.5% | 87.5% |
| quote | 10.5% | 50% |
| documentation | 12% | 67% |
| new_client | 2.6% | 100% |
| cancellation | 6.6% | 60% |

### Quick Task Templates

Pre-defined insurance workflows with:
- Default priority and subtasks
- Category classification
- Icon emoji
- Suggested subtasks

### Email Generation Warnings

| Warning Type | Description |
|--------------|-------------|
| `sensitive_info` | SSN, account numbers detected |
| `date_promise` | Specific dates/deadlines mentioned |
| `pricing` | Dollar amounts or pricing |
| `coverage_details` | Insurance coverage specifics |
| `negative_news` | Denials, cancellations |

---

## Environment Variables

### Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Services
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Integrations
OUTLOOK_ADDON_API_KEY=
```

### Optional

```env
# Feature Flags
NEXT_PUBLIC_ENABLE_OAUTH=
NEXT_PUBLIC_ENABLE_RLS=
NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA=
```

---

## Testing

### Run Tests

```bash
# Unit tests (Vitest)
npm run test

# E2E tests (Playwright)
npm run test:e2e

# With UI
npx playwright test --ui

# AI integration tests
npx tsx tests/run-email-tests.ts
```

### Test Users

| User | PIN | Role |
|------|-----|------|
| Derrick | 8008 | Owner (full access) |
| Sefra | 1234 | Team member |

---

## Common Operations

### Creating a Task

```typescript
const { data, error } = await supabase
  .from('todos')
  .insert({
    text: 'Task description',
    priority: 'high',
    created_by: currentUser.name,
    assigned_to: 'Derrick',
    status: 'todo'
  })
  .select()
  .single();

await logActivity({
  action: 'task_created',
  todo_id: data.id,
  todo_text: data.text,
  user_name: currentUser.name
});
```

### Updating a Task

```typescript
const { error } = await supabase
  .from('todos')
  .update({
    priority: 'urgent',
    updated_at: new Date().toISOString(),
    updated_by: currentUser.name
  })
  .eq('id', todoId);

await logActivity({
  action: 'priority_changed',
  todo_id: todoId,
  todo_text: todo.text,
  user_name: currentUser.name,
  details: { from: 'high', to: 'urgent' }
});
```

### Completing a Task

```typescript
const { error } = await supabase
  .from('todos')
  .update({
    completed: true,
    status: 'done',
    updated_at: new Date().toISOString()
  })
  .eq('id', todoId);

await logActivity({
  action: 'task_completed',
  todo_id: todoId,
  todo_text: todo.text,
  user_name: currentUser.name
});
```

---

## Agent-Specific Guidelines

### Backend Engineer

- Database operations in `src/lib/db/todoService.ts`
- API routes in `src/app/api/`
- Always use `SUPABASE_SERVICE_ROLE_KEY` for server-side operations
- Log all mutations with `logActivity()`
- Handle errors gracefully with proper HTTP status codes

### Frontend Engineer

- Components in `src/components/`
- Hooks in `src/hooks/`
- State in `src/store/todoStore.ts`
- Use Tailwind for styling
- Implement optimistic updates
- Subscribe to real-time for cross-client sync
- Support dark mode with `dark:` prefix

### Code Reviewer

- Check for real-time subscription cleanup
- Verify activity logging on mutations
- Ensure TypeScript strict mode compliance
- Look for SQL injection (use parameterized queries)
- Check file upload validation
- Verify owner-only feature guards

### Security Reviewer

- PIN is SHA-256 hashed (consider Argon2 migration)
- Sessions in localStorage (consider httpOnly cookies)
- RLS is permissive (application-level access control)
- File uploads have magic byte validation
- CSRF tokens on mutations
- API keys in environment variables

### Tech Lead

- Large components need refactoring (ChatPanel, StrategicDashboard)
- JSONB → relational schema migration in progress
- Feature flags for gradual rollout
- Real-time subscriptions are critical path
- OAuth support being added alongside PIN

### Business Analyst

- Insurance agency workflow tool
- Two users: Derrick (owner), Sefra (team)
- Key metrics: task completion rate, overdue tasks
- AI features: smart parse, email generation, transcription
- Strategic goals: owner-only planning dashboard

---

## Critical Files Reference

| Purpose | File Path |
|---------|-----------|
| Entry point | `src/app/page.tsx` |
| Main app shell | `src/components/MainApp.tsx` |
| All types | `src/types/todo.ts` |
| State store | `src/store/todoStore.ts` |
| DB client | `src/lib/supabaseClient.ts` |
| Auth logic | `src/lib/auth.ts` |
| Activity logging | `src/lib/activityLogger.ts` |
| Duplicate detection | `src/lib/duplicateDetection.ts` |
| File validation | `src/lib/fileValidator.ts` |
| Email generation | `src/app/api/ai/generate-email/route.ts` |
| Smart parse | `src/app/api/ai/smart-parse/route.ts` |
| DB migrations | `supabase/migrations/*.sql` |

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Real-time not syncing | Check table in `supabase_realtime` publication |
| AI timeout | Verify `ANTHROPIC_API_KEY` is valid |
| File upload fails | Use `SUPABASE_SERVICE_ROLE_KEY` |
| Login fails | Console log PIN hash, compare with DB |
| Dark mode broken | Check `ThemeContext` wrapper |
| Outlook add-in error | Verify `X-API-Key` header |

---

## Version Info

- **Last Updated**: 2026-01-18
- **App Version**: 2.1
- **Next.js**: 16.0.10
- **React**: 19.2.0
- **TypeScript**: 5.9.3
- **Supabase JS**: 2.48.0

---

*For detailed developer documentation, see [CLAUDE.md](./CLAUDE.md)*
*For product requirements, see [PRD.md](./PRD.md)*
