# Orchestrator Context Guide

> **For Multi-Agent Orchestrators**: This document provides structured context for AI orchestrator agents working on the Shared Todo List codebase. It's designed for quick parsing, reliable decision-making, and seamless agent handoffs.

---

## 🚀 Quick Start for Orchestrators

### Immediate Context
```yaml
project: Bealer Agency Shared Todo List
type: Collaborative task management (insurance agency)
stack: Next.js 16 + React 19 + TypeScript + Supabase + Tailwind
status: Production (https://shared-todo-list-production.up.railway.app)
users: Derrick (owner), Sefra (team member)
```

### Agent Dispatch Decision Tree
```
User Request
    │
    ├─ "Fix bug in..."           → Code Reviewer → Backend/Frontend Engineer
    ├─ "Add feature..."          → Business Analyst → Tech Lead → Engineers
    ├─ "Review security..."      → Security Reviewer
    ├─ "Analyze data..."         → Data Scientist
    ├─ "Improve performance..."  → Tech Lead → Backend Engineer
    ├─ "Update UI..."            → Frontend Engineer (check Design spec)
    ├─ "Database changes..."     → Database Engineer → Backend Engineer
    └─ "Deploy/release..."       → Tech Lead (check DEPLOYMENT_GUIDE.md)
```

### Critical Constraints (ALL AGENTS MUST FOLLOW)
1. **Always log activity** - Call `logActivity()` for ALL database mutations
2. **Clean up subscriptions** - Return cleanup function in all `useEffect` with subscriptions  
3. **Owner-only guard** - Check `currentUser?.name === 'Derrick'` for strategic features
4. **TypeScript strict** - All types in `src/types/todo.ts`
5. **Optimistic updates** - Update UI immediately, persist async, rollback on error

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
  display_order: number;         // Manual sort order (0-based, indexed)
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
| `/api/todos/reorder` | POST | Task reordering (3 modes: position, up/down, swap) |
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

## 🤖 Multi-Agent Orchestration

### Pipeline Stages

Standard feature development follows this pipeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AGENT PIPELINE STAGES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Stage 1: REQUIREMENTS                                              │
│  ├─ Business Analyst    - Gather requirements, write specs          │
│  └─ Output: PRD section, user stories, acceptance criteria          │
│                                                                     │
│  Stage 2: ARCHITECTURE                                              │
│  ├─ Tech Lead           - Design solution, identify files           │
│  ├─ Database Engineer   - Schema changes (if needed)                │
│  └─ Output: Tech spec, file list, API contracts                     │
│                                                                     │
│  Stage 3: IMPLEMENTATION                                            │
│  ├─ Backend Engineer    - API routes, database operations           │
│  ├─ Frontend Engineer   - Components, hooks, state                  │
│  └─ Output: Working code, unit tests                                │
│                                                                     │
│  Stage 4: VALIDATION                                                │
│  ├─ Code Reviewer       - Code quality, patterns                    │
│  ├─ Security Reviewer   - Vulnerabilities, auth                     │
│  └─ Output: Approved PR, security sign-off                          │
│                                                                     │
│  Stage 5: ANALYSIS (Optional)                                       │
│  ├─ Data Scientist      - Analytics, metrics, patterns              │
│  └─ Output: Dashboards, reports, ML models                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Handoff Protocol

When completing work, each agent MUST create a handoff document:

```markdown
# Agent Handoff: [Feature Name]

## Session Summary
- **Date**: YYYY-MM-DD
- **Agent Role**: [Your Role]
- **Status**: [Complete/Blocked/In Progress]

## What Was Done
- [List completed items]

## Files Modified/Created
| File | Status | Changes |
|------|--------|---------|
| path/to/file | ✅ Complete | Description |

## What's NOT Done (Next Steps)
1. [Next task for subsequent agent]

## Blocking Issues
- [Any blockers]

## Next Agent Instructions
### If Next Agent is [Role]
- Start with [file/document]
- Key context: [important info]

## Quick Reference
[Code snippets, types, or patterns the next agent needs]
```

### Agent Message Format

For inter-agent communication, use this structured format:

```yaml
---
from_agent: [role]
to_agent: [role]
priority: [high/medium/low]
context_files:
  - docs/RELEVANT_DOC.md
  - src/relevant/file.ts
blocking: [true/false]
---

## Request
[Clear description of what's needed]

## Context
[Relevant background]

## Expected Output
[What the receiving agent should produce]

## Deadline/Urgency
[Any time constraints]
```

### Orchestrator Decision Matrix

Use this matrix to route tasks to the correct agent:

| Task Pattern | Primary Agent | Secondary Agent | Key Files |
|-------------|---------------|-----------------|-----------|
| "Add API endpoint for X" | Backend Engineer | Code Reviewer | `src/app/api/` |
| "Create component for X" | Frontend Engineer | Code Reviewer | `src/components/` |
| "Fix bug where X" | Code Reviewer | Backend/Frontend | Varies |
| "Analyze data for X" | Data Scientist | Tech Lead | `docs/`, data files |
| "Improve security of X" | Security Reviewer | Backend Engineer | `src/lib/auth.ts` |
| "Design solution for X" | Tech Lead | Business Analyst | `docs/` |
| "Add database table for X" | Database Engineer | Backend Engineer | `supabase/migrations/` |
| "Optimize performance of X" | Tech Lead | Backend Engineer | Profile first |
| "Add tests for X" | Code Reviewer | Original author | `tests/` |

### Context Loading for Agents

Each agent should load these contexts based on their role:

```typescript
const agentContexts = {
  'business-analyst': [
    'PRD.md',
    'docs/user-stories/',
    'README.md'
  ],
  'tech-lead': [
    'ORCHESTRATOR.md',
    'CLAUDE.md', 
    'REFACTORING_PLAN.md',
    'src/types/todo.ts'
  ],
  'backend-engineer': [
    'ORCHESTRATOR.md#api-endpoints',
    'src/app/api/',
    'src/lib/db/',
    'src/lib/activityLogger.ts'
  ],
  'frontend-engineer': [
    'ORCHESTRATOR.md#component-architecture',
    'src/components/',
    'src/hooks/',
    'src/store/todoStore.ts',
    'src/types/todo.ts'
  ],
  'database-engineer': [
    'supabase/migrations/',
    'ORCHESTRATOR.md#database-schema',
    'src/types/todo.ts'
  ],
  'code-reviewer': [
    'ORCHESTRATOR.md#critical-constraints',
    '.eslintrc',
    'tsconfig.json'
  ],
  'security-reviewer': [
    'src/lib/auth.ts',
    'src/lib/fileValidator.ts',
    'src/middleware.ts',
    'SECURITY_IMPROVEMENT_CHECKLIST.md'
  ],
  'data-scientist': [
    'docs/DATA_SCIENCE_ANALYTICS_SCHEMA.md',
    'src/app/api/patterns/',
    'docs/TASK_CATEGORY_ANALYSIS_REPORT.md'
  ]
};
```

### Pipeline Status Tracking

Track pipeline progress using this format:

```
Feature: [Feature Name]
Status: [Planning/In Progress/Review/Complete]

┌──────────────────────────────────────────────────────────────┐
│ [✓] Business Analyst   - Requirements complete               │
│ [✓] Tech Lead          - Architecture defined                │
│ [~] Database Engineer  - Schema in progress                  │
│ [ ] Backend Engineer   - Waiting on schema                   │
│ [ ] Frontend Engineer  - Waiting on API                      │
│ [ ] Code Reviewer      - Pending                             │
│ [ ] Security Reviewer  - Pending                             │
└──────────────────────────────────────────────────────────────┘

Legend: [✓] Complete  [~] In Progress  [ ] Pending  [!] Blocked
```

### Parallel vs Sequential Work

**Can Run in Parallel:**
- Frontend Engineer + Backend Engineer (if API contract defined)
- Code Reviewer + Security Reviewer
- Data Scientist (usually independent)

**Must Run Sequentially:**
- Business Analyst → Tech Lead (requirements before architecture)
- Database Engineer → Backend Engineer (schema before queries)
- Implementation → Code Review (code before review)

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

## Orchestrator Tools & Utilities

### MCP Server Integration (Serena)

This project supports the Serena MCP server for enhanced code navigation:

```yaml
# Available Serena Tools
- find_symbol: Find code symbols by name path
- find_referencing_symbols: Find all references to a symbol
- get_symbols_overview: Get high-level file structure
- replace_symbol_body: Replace entire function/class bodies
- insert_after_symbol: Add code after a symbol
- search_for_pattern: Regex search across codebase
- read_memory / write_memory: Persist agent context
```

### Memory Files for Context Persistence

Agents can persist important context using memory files:

| Memory File | Purpose |
|-------------|---------|
| `project_overview.md` | High-level project context |
| `suggested_commands.md` | Development commands reference |
| `code_style_conventions.md` | Coding patterns and standards |
| `task_completion_checklist.md` | Post-task verification steps |
| `codebase_structure.md` | Directory structure guide |
| `agent_handoffs.md` | Recent handoff summaries |

### Useful Commands for Orchestrators

```bash
# Check project health
npm run build && npm run lint && npm run test

# View recent changes
git log --oneline -20

# Check for uncommitted changes
git status

# Search codebase
grep -r "pattern" src/

# Find files
find src -name "*.tsx" | head -20
```

---

## Quick Reference Cards

### Card 1: Creating a New Feature

```
1. Check PRD.md for requirements
2. Read REFACTORING_PLAN.md for constraints
3. Create docs/FEATURE_NAME_SPEC.md
4. Identify files to modify (use Serena tools)
5. Implement with activity logging
6. Add tests in tests/
7. Create handoff doc in docs/
```

### Card 2: Bug Fix Workflow

```
1. Reproduce the bug
2. Find relevant code (grep/Serena)
3. Understand data flow
4. Fix with minimal changes
5. Add regression test
6. Log in activity_log if data changed
7. Update WHATS_NEW.md
```

### Card 3: Code Review Checklist

```
[ ] Real-time subscriptions cleaned up
[ ] Activity logging on all mutations
[ ] TypeScript strict compliance
[ ] Owner-only guards where needed
[ ] Optimistic updates with rollback
[ ] Error handling with user messages
[ ] Mobile responsive (test with DevTools)
[ ] Dark mode supported
```

---

## Version Info

- **Last Updated**: 2026-02-03
- **Document Version**: 3.1 (Task Reordering & UX Enhancements)
- **App Version**: 2.4
- **Next.js**: 16.0.10
- **React**: 19.2.0
- **TypeScript**: 5.9.3
- **Supabase JS**: 2.48.0

### Recent Updates (v2.4)
- ✅ Task reordering API with 3 modes (`/api/todos/reorder`)
- ✅ Database `display_order` column with migration
- ✅ New UI components: SaveIndicator, Accordion, AIFeaturesMenu
- ✅ Enhanced TaskDetailModal with visual cards
- ✅ Template picker with `Cmd+T` shortcut
- ✅ Keyboard shortcuts: `Cmd+A`, `?` global help
- ✅ WCAG 2.1 compliance: 44px touch targets
- ✅ Real-time subscription array normalization fix

---

## Related Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [CLAUDE.md](./CLAUDE.md) | Detailed developer guide | Deep implementation |
| [PRD.md](./PRD.md) | Product requirements | Business context |
| [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) | 12-week improvement roadmap | Before major changes |
| [SETUP.md](./SETUP.md) | Installation guide | Environment setup |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Deploy process | Releasing changes |
| [SECURITY_IMPROVEMENT_CHECKLIST.md](./SECURITY_IMPROVEMENT_CHECKLIST.md) | Security tasks | Security reviews |
| [docs/FRONTEND_ENGINEER_HANDOFF.md](./docs/FRONTEND_ENGINEER_HANDOFF.md) | Frontend patterns | UI implementation |
| [docs/PIPELINE_CONTEXT_NEXT_AGENT.md](./docs/PIPELINE_CONTEXT_NEXT_AGENT.md) | Pipeline example | Agent handoffs |

---

*This document is optimized for multi-agent orchestrator systems. For single-agent use, see [CLAUDE.md](./CLAUDE.md)*
