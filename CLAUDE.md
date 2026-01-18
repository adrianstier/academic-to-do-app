# Claude Code Developer Guide

This document provides comprehensive context for AI assistants (like Claude Code) working on the Bealer Agency Todo List codebase.

> **For Multi-Agent Orchestrators**: See [ORCHESTRATOR.md](./ORCHESTRATOR.md) for a structured, quick-reference guide optimized for orchestrator agents.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack Details](#tech-stack-details)
4. [Database Schema Deep Dive](#database-schema-deep-dive)
5. [Component Architecture](#component-architecture)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Real-Time Sync Patterns](#real-time-sync-patterns)
8. [AI Integration](#ai-integration)
9. [Authentication & Security](#authentication--security)
10. [Common Patterns & Conventions](#common-patterns--conventions)
11. [Debugging & Troubleshooting](#debugging--troubleshooting)
12. [Testing Strategy](#testing-strategy)
13. [Deployment](#deployment)
14. [**🚀 Refactoring Plan**](#refactoring-plan) ⭐ **NEW**
15. [**🤖 Orchestrator Agent Guide**](#orchestrator-agent-guide) ⭐ **NEW**

---

## Project Overview

### What This App Does

The Bealer Agency Todo List is a **comprehensive collaborative task management platform** built specifically for the Bealer Agency (Allstate insurance agency). It combines:

- **Task Management**: Full CRUD with subtasks, attachments, notes, recurrence
- **Team Collaboration**: Real-time chat, DMs, message reactions, presence tracking
- **Strategic Planning**: Owner-only goals dashboard with milestones and progress tracking
- **AI-Powered Workflows**: Smart parsing, transcription, email generation, task enhancement
- **Analytics**: Activity feed, dashboard with stats, weekly progress charts
- **Integration**: Outlook add-in for email-to-task conversion

### Target Users

- **Derrick** (Owner/Admin): Has access to Strategic Goals dashboard
- **Sefra** (Team Member): Standard user access
- Small insurance agency team (2-10 people)

### Key Differentiators

1. **Insurance-Specific Features**: Email generation with insurance agent tone
2. **AI-First**: Multiple AI endpoints for task parsing, transcription, enhancement
3. **Real-Time Everything**: Tasks, chat, activity all sync instantly
4. **Highly Polished UX**: Dark mode, animations, keyboard shortcuts, mobile-optimized

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Next.js 16 App                        │
│                    (App Router + React 19)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Dashboard  │  │  Tasks View  │  │  Chat Panel  │    │
│  │   (Stats)    │  │ (List/Kanban)│  │  (Messages)  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Strategic   │  │  Activity    │  │  Outlook     │    │
│  │    Goals     │  │    Feed      │  │   Add-in     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     API Routes (17)                         │
│  /api/outlook/* | /api/ai/* | /api/goals/* | /api/*       │
├─────────────────────────────────────────────────────────────┤
│                   Supabase Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  PostgreSQL  │  │  Real-time   │  │   Storage    │    │
│  │  (9 tables)  │  │  Channels    │  │  (Files)     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
              ┌─────────────────────────┐
              │   External AI Services   │
              │  • Anthropic Claude API  │
              │  • OpenAI Whisper API    │
              └─────────────────────────┘
```

### Data Flow Pattern

```
User Action (Client)
    ↓
React Component State Update (Optimistic)
    ↓
Supabase Client API Call
    ↓
PostgreSQL Database Mutation
    ↓
Supabase Real-time Broadcast
    ↓
All Connected Clients Receive Update
    ↓
React Components Re-render
```

### App Router Structure

```
src/
├── app/
│   ├── page.tsx                    # Main entry (auth + app shell)
│   ├── layout.tsx                  # Root layout with theme provider
│   ├── api/                        # API routes
│   │   ├── ai/                     # 8 AI endpoints
│   │   ├── outlook/                # 3 Outlook endpoints
│   │   ├── templates/              # Template CRUD
│   │   ├── activity/               # Activity logging
│   │   ├── attachments/            # File uploads
│   │   ├── goals/                  # Goals CRUD
│   │   │   ├── categories/         # Goal categories
│   │   │   └── milestones/         # Goal milestones
│   └── outlook-setup/              # Outlook add-in instructions
└── components/                     # 32+ React components
```

---

## Tech Stack Details

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.10 | React framework with App Router |
| React | 19.2.0 | UI library |
| TypeScript | 5.9.3 | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| Framer Motion | 12.8.0 | Animations |
| @dnd-kit | 8.x | Drag-and-drop (Kanban) |
| lucide-react | Latest | Icon library (556 icons) |
| date-fns | 4.1.0 | Date utilities |
| uuid | 11.0.6 | Unique ID generation |

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | 16.0.10 | Server-side endpoints |
| Supabase JS | 2.48.0 | Database + real-time client |
| Anthropic SDK | 0.38.0 | Claude AI API |
| OpenAI SDK | Implicit | Whisper transcription |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Supabase | PostgreSQL database, real-time subscriptions, file storage |
| Railway | Docker deployment platform |
| Anthropic | AI parsing, enhancement, email generation |
| OpenAI | Voice transcription (Whisper) |

### Development Tools

| Tool | Purpose |
|------|---------|
| Playwright | 1.57.0 - E2E testing |
| ESLint | 9.x - Code linting |
| PostCSS | Tailwind processing |
| Turbopack | Next.js 16 bundler |

---

## Database Schema Deep Dive

### Core Tables

#### `users` table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,  -- SHA-256 hash
  color TEXT DEFAULT '#0033A0',  -- User color for UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  streak_count INTEGER DEFAULT 0,  -- Login streak
  streak_last_date DATE,
  welcome_shown_at TIMESTAMP WITH TIME ZONE  -- Last welcome notification
);
```

**Key Points:**
- No email/password - PIN-only authentication
- `pin_hash` is SHA-256 of 4-digit PIN (hashed client-side)
- `color` is one of 8 Allstate brand colors (assigned at registration)
- Streak tracking for gamification

#### `todos` table
```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'todo',  -- 'todo' | 'in_progress' | 'done'
  priority TEXT DEFAULT 'medium',  -- 'low' | 'medium' | 'high' | 'urgent'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL,  -- User name (not ID)
  assigned_to TEXT,  -- User name or NULL
  due_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  recurrence TEXT,  -- 'daily' | 'weekly' | 'monthly' | NULL
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT,
  -- Advanced fields
  subtasks JSONB DEFAULT '[]'::jsonb,  -- Array of subtask objects
  attachments JSONB DEFAULT '[]'::jsonb,  -- Array of attachment metadata
  transcription TEXT,  -- Voicemail transcription
  merged_from UUID[]  -- IDs of tasks merged into this one
);
```

**Subtask Structure (JSONB):**
```json
{
  "id": "uuid-string",
  "text": "Subtask description",
  "completed": false,
  "priority": "medium",
  "estimatedMinutes": 30
}
```

**Attachment Structure (JSONB):**
```json
{
  "id": "uuid-string",
  "file_name": "document.pdf",
  "file_type": "pdf",  // "pdf" | "image" | "audio" | "video" | "document" | "archive"
  "file_size": 1048576,  // bytes
  "mime_type": "application/pdf",
  "storage_path": "todos/task-id/document.pdf",
  "uploaded_by": "Derrick",
  "uploaded_at": "2025-01-08T10:00:00Z"
}
```

#### `messages` table (Chat)
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  created_by TEXT NOT NULL,  -- User name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  related_todo_id UUID,  -- NULL for general chat, UUID for task discussions
  recipient TEXT,  -- NULL for team chat, user name for DMs
  reactions JSONB DEFAULT '[]'::jsonb,  -- Array of reaction objects
  read_by TEXT[] DEFAULT '{}',  -- Array of user names who read
  reply_to_id UUID,  -- Parent message ID for threading
  reply_to_text TEXT,  -- Cached parent text
  reply_to_user TEXT,  -- Cached parent user
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,  -- Soft delete
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_by TEXT,
  pinned_at TIMESTAMP WITH TIME ZONE,
  mentions TEXT[] DEFAULT '{}'  -- Array of @mentioned user names
);
```

**Reaction Structure (JSONB):**
```json
{
  "type": "heart",  // "heart" | "thumbsup" | "thumbsdown" | "laugh" | "exclamation" | "question"
  "userName": "Derrick",
  "createdAt": "2025-01-08T10:00:00Z"
}
```

#### `activity_log` table
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,  -- Constrained to 15+ action types
  todo_id UUID,
  todo_text TEXT,
  user_name TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Action Types:**
- `task_created`, `task_updated`, `task_deleted`
- `task_completed`, `task_reopened`
- `status_changed`, `priority_changed`, `assigned_to_changed`, `due_date_changed`
- `subtask_added`, `subtask_completed`, `subtask_deleted`
- `notes_updated`
- `template_created`, `template_used`
- `attachment_added`, `attachment_removed`
- `tasks_merged`

**Details Structure (JSONB) - varies by action:**
```json
{
  "from": "medium",
  "to": "urgent"
}
```

#### `task_templates` table
```sql
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  default_priority TEXT DEFAULT 'medium',
  default_assigned_to TEXT,
  subtasks JSONB DEFAULT '[]'::jsonb,  -- Same structure as todos.subtasks
  created_by TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,  -- Shared with team or private
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Strategic Goals Tables

**`strategic_goals`:**
```sql
CREATE TABLE strategic_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES goal_categories(id),
  status TEXT DEFAULT 'not_started',  -- 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
  priority TEXT DEFAULT 'medium',  -- 'low' | 'medium' | 'high' | 'critical'
  target_date DATE,
  target_value TEXT,  -- e.g., "$1M revenue"
  current_value TEXT,  -- e.g., "$750K"
  progress_percent INTEGER DEFAULT 0,  -- 0-100
  notes TEXT,
  display_order INTEGER,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`goal_categories` (6 predefined):**
```sql
CREATE TABLE goal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,  -- Hex color
  icon TEXT,  -- Icon name
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Categories:
1. Revenue & Growth (🟢 Green)
2. Client Acquisition (🔵 Blue)
3. Team Development (🟣 Purple)
4. Operations (🟠 Orange)
5. Marketing (🩷 Pink)
6. Product Lines (🔷 Blue Diamond)

**`goal_milestones`:**
```sql
CREATE TABLE goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES strategic_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  target_date DATE,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `device_tokens` table (Push Notifications)
```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,  -- 'ios' | 'android' | 'web'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row-Level Security (RLS)

All tables have RLS enabled with permissive policies:
```sql
CREATE POLICY "Allow all operations" ON table_name
  FOR ALL USING (true) WITH CHECK (true);
```

**Access control is enforced at the application level, not database level.**

### Real-Time Publications

These tables are published for real-time subscriptions:
- `todos`
- `messages`
- `activity_log`
- `strategic_goals`
- `goal_milestones`

Enable real-time:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- etc.
```

---

## Component Architecture

### Component Hierarchy

```
App Entry: page.tsx (auth state)
│
├── LoginScreen.tsx (if not authenticated)
│
└── MainApp.tsx (if authenticated)
    │
    ├── Dashboard.tsx (view === 'dashboard')
    │   ├── ProgressSummary.tsx
    │   └── WeeklyProgressChart.tsx
    │
    ├── TodoList.tsx (view === 'tasks')
    │   ├── AddTodo.tsx
    │   │   ├── SmartParseModal.tsx
    │   │   ├── TemplatePicker.tsx
    │   │   └── SaveTemplateModal.tsx
    │   │
    │   ├── TodoItem.tsx (list mode)
    │   │   ├── AttachmentList.tsx
    │   │   ├── DuplicateDetectionModal.tsx
    │   │   └── CustomerEmailModal.tsx
    │   │
    │   └── KanbanBoard.tsx (kanban mode)
    │       └── SortableTodoItem.tsx
    │
    ├── ChatPanel.tsx
    │   └── VoiceRecordingIndicator.tsx
    │
    ├── StrategicDashboard.tsx (owner only)
    │
    ├── ActivityFeed.tsx
    │
    └── Global UI Components
        ├── UserSwitcher.tsx
        ├── PullToRefresh.tsx
        ├── KeyboardShortcutsModal.tsx
        ├── ConfirmDialog.tsx
        ├── EmptyState.tsx
        └── CelebrationEffect.tsx
```

### Key Component Patterns

#### Real-Time Subscription Pattern
```typescript
useEffect(() => {
  const channel = supabase
    .channel('unique-channel-name')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'todos' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setTodos(prev => [payload.new as Todo, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTodos(prev => prev.map(t =>
            t.id === payload.new.id ? payload.new as Todo : t
          ));
        } else if (payload.eventType === 'DELETE') {
          setTodos(prev => prev.filter(t => t.id !== payload.old.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

#### State Management Pattern
```typescript
// Local state for UI
const [todos, setTodos] = useState<Todo[]>([]);
const [loading, setLoading] = useState(true);

// Memoized computed values
const completedCount = useMemo(() =>
  todos.filter(t => t.completed).length,
  [todos]
);

// Callback-wrapped handlers
const handleComplete = useCallback(async (id: string) => {
  // Optimistic update
  setTodos(prev => prev.map(t =>
    t.id === id ? { ...t, completed: !t.completed } : t
  ));

  // Persist to database
  await supabase
    .from('todos')
    .update({ completed: true })
    .eq('id', id);
}, []);
```

### Component File Sizes (Top 10)

1. `ChatPanel.tsx` - 2,062 lines
2. `StrategicDashboard.tsx` - 1,463 lines
3. `TodoList.tsx` - 1,200+ lines
4. `KanbanBoard.tsx` - 800+ lines
5. `Dashboard.tsx` - 662 lines
6. `ActivityFeed.tsx` - 505 lines
7. `TodoItem.tsx` - 450+ lines
8. `AddTodo.tsx` - 400+ lines
9. `LoginScreen.tsx` - 350+ lines
10. `CustomerEmailModal.tsx` - 300+ lines

---

## API Endpoints Reference

### Outlook Integration Endpoints

#### `GET /api/outlook/users`
- **Auth**: Requires `X-API-Key` header
- **Purpose**: List all registered users for Outlook add-in
- **Response**:
```json
{
  "users": [
    { "id": "uuid", "name": "Derrick", "color": "#0033A0" }
  ]
}
```

#### `POST /api/outlook/parse-email`
- **Auth**: Requires `X-API-Key` header
- **Purpose**: AI-powered email parsing to extract task details
- **Request**:
```json
{
  "subject": "Policy renewal for John Smith",
  "body": "Email body text...",
  "from": "customer@example.com",
  "users": ["Derrick", "Sefra"]
}
```
- **Response**:
```json
{
  "taskDescription": "Process policy renewal for John Smith",
  "assignedTo": "Derrick",
  "priority": "high",
  "dueDate": "2025-01-15",
  "notes": "Customer mentioned..."
}
```

#### `POST /api/outlook/create-task`
- **Auth**: Requires `X-API-Key` header
- **Purpose**: Create a new task from Outlook
- **Request**:
```json
{
  "text": "Task description",
  "priority": "high",
  "assignedTo": "Derrick",
  "dueDate": "2025-01-15",
  "notes": "Additional context",
  "createdBy": "Derrick"
}
```

### AI Endpoints

#### `POST /api/ai/smart-parse`
- **Auth**: None (internal)
- **Purpose**: Parse natural language text into task + subtasks
- **Request**:
```json
{
  "text": "Call John about his auto policy renewal by Friday. Need to: review coverage, calculate premium, prepare quote",
  "users": ["Derrick", "Sefra"]
}
```
- **Response**:
```json
{
  "mainTask": {
    "text": "Call John about auto policy renewal",
    "priority": "high",
    "assignedTo": "Derrick",
    "dueDate": "2025-01-12"
  },
  "subtasks": [
    { "text": "Review current coverage", "priority": "medium" },
    { "text": "Calculate new premium", "priority": "medium" },
    { "text": "Prepare renewal quote", "priority": "high" }
  ]
}
```

#### `POST /api/ai/enhance-task`
- **Purpose**: Improve task clarity and extract metadata
- **Request**:
```json
{
  "text": "call john asap about thing",
  "users": ["Derrick", "Sefra"]
}
```
- **Response**:
```json
{
  "enhancedText": "Call John about policy matter (urgent)",
  "priority": "urgent",
  "suggestions": {
    "assignedTo": "Derrick",
    "notes": "Follow up on policy-related issue"
  }
}
```

#### `POST /api/ai/breakdown-task`
- **Purpose**: Generate detailed subtasks for complex task
- **Request**:
```json
{
  "taskText": "Onboard new commercial client",
  "taskContext": "Large manufacturing company, 50 employees"
}
```
- **Response**:
```json
{
  "subtasks": [
    {
      "text": "Collect business information and documentation",
      "priority": "high",
      "estimatedMinutes": 30
    },
    {
      "text": "Assess coverage needs and risk factors",
      "priority": "high",
      "estimatedMinutes": 45
    },
    ...
  ]
}
```

#### `POST /api/ai/transcribe`
- **Purpose**: Transcribe audio to text using Whisper, optionally parse as tasks
- **Request**: Multipart form data with `audio` file
- **Query Params**:
  - `mode`: `'text'` (transcript only) or `'tasks'` (parse into tasks)
  - `users`: JSON array of user names (if mode=tasks)
- **Response (mode=text)**:
```json
{
  "transcription": "John called about his policy renewal..."
}
```
- **Response (mode=tasks)**:
```json
{
  "tasks": [
    {
      "text": "Follow up on John's policy renewal",
      "priority": "high",
      "transcription": "John called about..."
    }
  ]
}
```

#### `POST /api/ai/parse-voicemail`
- **Purpose**: Extract actionable task from voicemail transcription
- **Request**:
```json
{
  "transcription": "Hi this is Sarah, my policy number is 12345...",
  "users": ["Derrick", "Sefra"]
}
```
- **Response**: Same as `smart-parse`

#### `POST /api/ai/parse-file`
- **Purpose**: Extract text and tasks from uploaded documents
- **Request**: Multipart form data with `file`
- **Response**: Similar to `smart-parse` with extracted content

#### `POST /api/ai/parse-content-to-subtasks`
- **Purpose**: Convert bullet points or paragraphs into subtasks
- **Request**:
```json
{
  "content": "- Review policy\n- Calculate premium\n- Send quote",
  "parentTaskText": "Process renewal"
}
```
- **Response**:
```json
{
  "subtasks": [
    { "text": "Review policy", "priority": "medium" },
    { "text": "Calculate premium", "priority": "medium" },
    { "text": "Send quote", "priority": "high" }
  ]
}
```

#### `POST /api/ai/generate-email`
- **Purpose**: Generate professional customer email from task(s)
- **Request**:
```json
{
  "customerName": "John Smith",
  "tasks": [
    {
      "text": "Process auto policy renewal",
      "notes": "Discussed coverage options",
      "completed": true,
      "subtasks": [
        { "text": "Review coverage", "completed": true },
        { "text": "Calculate premium", "completed": true }
      ],
      "transcription": "Customer mentioned...",
      "attachments": [
        { "file_name": "quote.pdf", "file_type": "pdf" }
      ]
    }
  ],
  "tone": "friendly"  // or "formal" or "brief"
}
```
- **Response**:
```json
{
  "subject": "Update on Your Auto Policy Renewal",
  "body": "Hi John,\n\nI wanted to reach out regarding your auto policy renewal...",
  "warnings": [
    {
      "type": "date_promise",
      "message": "Email mentions 'by Friday' - verify this is achievable",
      "severity": "medium"
    }
  ]
}
```

**Warning Types**:
- `sensitive_info`: SSN, account numbers detected
- `date_promise`: Specific dates or deadlines mentioned
- `pricing`: Dollar amounts or pricing details
- `coverage_details`: Insurance coverage specifics
- `negative_news`: Denials, cancellations, bad news

### Data Management Endpoints

#### `GET /api/templates`
- **Purpose**: Fetch user's templates
- **Query**: `?userName=Derrick`
- **Response**: Array of `TaskTemplate` objects

#### `POST /api/templates`
- **Purpose**: Create new template
- **Request**: `TaskTemplate` object

#### `DELETE /api/templates`
- **Purpose**: Delete template
- **Query**: `?id=uuid`

#### `GET /api/activity`
- **Purpose**: Fetch activity log
- **Query**: `?userName=Derrick` (optional, filters to user's actions)
- **Response**: Array of `ActivityLogEntry` objects

#### `POST /api/activity`
- **Purpose**: Log new activity
- **Request**: `ActivityLogEntry` object

#### `POST /api/attachments`
- **Purpose**: Upload file attachment
- **Request**: Multipart form data
  - `file`: File to upload
  - `todoId`: UUID of parent task
  - `uploadedBy`: User name
- **Response**:
```json
{
  "attachment": {
    "id": "uuid",
    "file_name": "document.pdf",
    "storage_path": "todos/task-id/document.pdf",
    "file_size": 1048576,
    ...
  }
}
```

#### Goal Endpoints
- `GET /api/goals` - Fetch goals with categories and milestones
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal
- `GET/POST /api/goals/categories` - Manage categories
- `GET/POST /api/goals/milestones` - Manage milestones

---

## Real-Time Sync Patterns

### Pattern 1: Simple Table Subscription

```typescript
useEffect(() => {
  const channel = supabase
    .channel('todos-channel')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'todos' },
      handleTodoChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

### Pattern 2: Filtered Subscription

```typescript
const channel = supabase
  .channel('my-todos')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'todos',
      filter: `assigned_to=eq.${currentUser.name}`
    },
    handleChange
  )
  .subscribe();
```

### Pattern 3: Multiple Table Subscription

```typescript
const channel = supabase
  .channel('dashboard-data')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'todos' },
    handleTodoChange
  )
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'messages' },
    handleMessageChange
  )
  .subscribe();
```

### Pattern 4: Presence Tracking (Chat)

```typescript
const channel = supabase.channel('online-users', {
  config: { presence: { key: currentUser.name } }
});

// Track presence
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    setOnlineUsers(Object.keys(state));
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user: currentUser.name,
        online_at: new Date().toISOString()
      });
    }
  });
```

### Optimistic Updates Best Practice

```typescript
const handleComplete = async (todoId: string) => {
  // 1. Optimistic update (instant UI feedback)
  setTodos(prev => prev.map(t =>
    t.id === todoId ? { ...t, completed: true } : t
  ));

  try {
    // 2. Persist to database
    const { error } = await supabase
      .from('todos')
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq('id', todoId);

    if (error) throw error;

    // 3. Real-time broadcast will sync to other clients
    // No need to refetch - subscription will update us if needed

  } catch (error) {
    // 4. Rollback on error
    console.error('Failed to complete todo:', error);
    setTodos(prev => prev.map(t =>
      t.id === todoId ? { ...t, completed: false } : t
    ));
    alert('Failed to update task');
  }
};
```

---

## AI Integration

### Claude API Usage

All AI endpoints use the Anthropic Claude API (Sonnet 3.5 or similar).

**Common Pattern:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: `Parse this into a task: ${userInput}`
    }
  ]
});

const response = message.content[0].text;
const parsed = JSON.parse(response);
```

### System Prompts

**Smart Parse System Prompt:**
```
You are a task parsing assistant for an insurance agency.
Parse the input into a main task and 2-6 subtasks.
Extract:
- Priority (low/medium/high/urgent) - look for urgency indicators
- Due date - parse relative dates like "tomorrow", "next Friday"
- Assignee - match names from the provided user list
Return JSON format: { mainTask: {...}, subtasks: [...] }
```

**Email Generation System Prompt:**
```
You are writing an email on behalf of an insurance agent.
Tone: Professional, warm, relationship-focused.
Include:
- Reference any voicemail transcription naturally
- Acknowledge attached documents
- Show progress on subtasks to demonstrate thoroughness
- Use insurance terminology (policy, coverage, premium, carrier)
Flag warnings for:
- Sensitive data (SSN, account numbers)
- Date promises
- Pricing/coverage details
Return: { subject, body, warnings: [...] }
```

### OpenAI Whisper for Transcription

```typescript
const formData = new FormData();
formData.append('file', audioFile);
formData.append('model', 'whisper-1');

const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  },
  body: formData
});

const { text } = await response.json();
// text is the transcription
```

---

## Authentication & Security

### PIN-Based Authentication Flow

1. **User Registration** (LoginScreen.tsx):
```typescript
const registerUser = async (name: string, pin: string) => {
  // Hash PIN client-side
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const pin_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Store in database
  const { data: user, error } = await supabase
    .from('users')
    .insert({ name, pin_hash, color: randomColor() })
    .select()
    .single();

  return user;
};
```

2. **PIN Verification** (LoginScreen.tsx):
```typescript
const verifyPin = async (userId: string, pin: string) => {
  const pin_hash = await hashPin(pin);

  const { data: user } = await supabase
    .from('users')
    .select()
    .eq('id', userId)
    .eq('pin_hash', pin_hash)
    .single();

  return user !== null;
};
```

3. **Session Storage** (localStorage):
```typescript
interface StoredSession {
  userId: string;
  userName: string;
  loginAt: string;
}

localStorage.setItem('todoSession', JSON.stringify({
  userId: user.id,
  userName: user.name,
  loginAt: new Date().toISOString()
}));
```

4. **Lockout Mechanism**:
- 3 failed attempts → 30-second lockout
- Counter stored in component state (not persisted)

### API Key Authentication (Outlook)

Outlook endpoints require `X-API-Key` header:
```typescript
const apiKey = request.headers.get('X-API-Key');
if (apiKey !== process.env.OUTLOOK_ADDON_API_KEY) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Access Control

**Owner-Only Features** (checked in component):
```typescript
const isOwner = currentUser?.name === 'Derrick';

{isOwner && (
  <button onClick={openStrategicDashboard}>
    Strategic Goals
  </button>
)}
```

**No row-level security at database level** - all access control is application-level.

---

## Common Patterns & Conventions

### File Naming
- Components: `PascalCase.tsx` (e.g., `TodoList.tsx`)
- Utilities: `camelCase.ts` (e.g., `duplicateDetection.ts`)
- API routes: `route.ts` (Next.js App Router convention)

### Component Structure
```typescript
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Todo } from '@/types/todo';

interface MyComponentProps {
  todos: Todo[];
  onUpdate: (todo: Todo) => void;
}

export function MyComponent({ todos, onUpdate }: MyComponentProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Side effects
  }, []);

  const handleAction = async () => {
    // Event handlers
  };

  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

### TypeScript Conventions
- All types defined in `src/types/todo.ts`
- Prefer interfaces over types for objects
- Use enums for string unions:
```typescript
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}
```

### Styling Conventions
- Tailwind utility classes for all styling
- CSS variables for theme colors:
  - `--brand-blue`: `#0033A0`
  - `--sky-blue`: `#72B5E8`
  - `--gold`: `#C9A227`
- Dark mode: `dark:` prefix in Tailwind classes
- Responsive: `sm:`, `md:`, `lg:` breakpoints

### Error Handling
```typescript
try {
  const { data, error } = await supabase.from('todos').select();
  if (error) throw error;
  setTodos(data);
} catch (error) {
  console.error('Failed to fetch todos:', error);
  // User-friendly error message
  alert('Failed to load tasks. Please refresh.');
}
```

### Activity Logging
```typescript
import { logActivity } from '@/lib/activityLogger';

await logActivity({
  action: 'task_created',
  todo_id: newTodo.id,
  todo_text: newTodo.text,
  user_name: currentUser.name,
  details: { priority: newTodo.priority }
});
```

---

## Debugging & Troubleshooting

### Common Issues

#### Real-Time Not Working
**Symptoms:** Changes don't appear on other clients

**Debug steps:**
1. Check Supabase dashboard → Database → Replication → Ensure tables are published
2. Console log in subscription handler to verify events are firing
3. Check channel subscription status:
```typescript
.subscribe((status) => {
  console.log('Channel status:', status);  // Should be 'SUBSCRIBED'
});
```
4. Verify `.removeChannel()` is called in cleanup

#### Authentication Fails
**Symptoms:** PIN correct but login fails

**Debug steps:**
1. Console log the hashed PIN and compare with database
2. Check for extra whitespace in PIN or username
3. Verify Supabase connection:
```typescript
const { data, error } = await supabase.from('users').select().limit(1);
console.log('Supabase connection:', data, error);
```

#### AI Endpoints Timeout
**Symptoms:** AI features hang or fail

**Debug steps:**
1. Check `ANTHROPIC_API_KEY` in Railway environment
2. Verify API key has credits (check Anthropic console)
3. Check rate limiting (max 60 req/min on tier 1)
4. Console log request/response:
```typescript
console.log('AI request:', { prompt, model });
const response = await anthropic.messages.create(...);
console.log('AI response:', response);
```

#### File Uploads Fail
**Symptoms:** Attachments don't upload

**Debug steps:**
1. Check `SUPABASE_SERVICE_ROLE_KEY` (not anon key!)
2. Verify storage bucket exists in Supabase dashboard
3. Check file size (25MB max)
4. Console log upload error:
```typescript
const { data, error } = await supabase.storage.from('todo-attachments').upload(...);
if (error) console.error('Upload error:', error);
```

### Console Debugging

Enable verbose logging:
```typescript
// In MainApp.tsx or wherever real-time is used
useEffect(() => {
  const channel = supabase.channel('todos-debug')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
      console.log('📨 Real-time event:', payload.eventType, payload.new || payload.old);
    })
    .subscribe((status) => {
      console.log('🔌 Channel status:', status);
    });

  return () => {
    console.log('🔌 Unsubscribing from channel');
    supabase.removeChannel(channel);
  };
}, []);
```

### Network Debugging

Use browser DevTools Network tab:
- Filter by `supabase.co` to see database requests
- Filter by `anthropic.com` to see AI requests
- Look for 401/403 errors (auth issues)
- Look for 429 errors (rate limiting)

---

## Testing Strategy

### E2E Tests (Playwright)

**Test Files:** `tests/*.spec.ts`

**Run tests:**
```bash
npm run dev  # Start server
npx playwright test
npx playwright test --ui  # With UI
```

**Example test:**
```typescript
test('create and complete task', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Login
  await page.click('[data-testid="user-card-Derrick"]');
  await page.fill('[data-testid="pin-input"]', '8008');
  await page.click('[data-testid="login-button"]');

  // Create task
  await page.fill('[data-testid="task-input"]', 'Test task');
  await page.click('[data-testid="add-task-button"]');

  // Verify task appears
  await expect(page.locator('text=Test task')).toBeVisible();

  // Complete task
  await page.click('[data-testid="task-checkbox"]');
  await expect(page.locator('[data-testid="task-item"]')).toHaveClass(/completed/);
});
```

### Manual Testing Checklist

See `tests/MANUAL_EMAIL_TESTS.md` for comprehensive manual testing guide.

**Key flows to test:**
1. Authentication (login, user switching, PIN failure)
2. Task CRUD (create, edit, complete, delete)
3. Real-time sync (multi-tab testing)
4. Kanban drag-and-drop
5. Chat (messages, reactions, threading)
6. AI features (smart parse, email generation)
7. Attachments (upload, download, preview)
8. Dark mode toggle
9. Mobile responsiveness

### Integration Tests

**AI Endpoint Tests:** `tests/run-email-tests.ts`

Run with:
```bash
npm run dev
npx tsx tests/run-email-tests.ts
```

Covers:
- Email generation with all features
- Warning detection
- Tone variations
- Error handling

---

## Deployment

### Railway Deployment

**Setup:**
1. Push to GitHub
2. Connect Railway to repo
3. Add environment variables
4. Deploy

**Environment Variables (Railway):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
OUTLOOK_ADDON_API_KEY
```

**Build Command:** `npm run build`
**Start Command:** `npm start`

### Dockerfile

The project includes a `Dockerfile` for containerized deployment:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Post-Deployment Checklist

1. ✅ Verify all environment variables are set
2. ✅ Test login flow
3. ✅ Create a test task
4. ✅ Test real-time sync (open two tabs)
5. ✅ Test AI features (smart parse, email generation)
6. ✅ Test Outlook add-in (if applicable)
7. ✅ Check Supabase connection (query should work)
8. ✅ Verify file uploads work
9. ✅ Test dark mode toggle
10. ✅ Check mobile responsiveness

### Monitoring

**Key metrics to monitor:**
- API response times (should be <500ms)
- AI endpoint latency (should be <5s)
- Database query performance
- Real-time connection stability
- File upload success rate

**Error tracking:**
- Check Railway logs for server errors
- Monitor Supabase dashboard for database errors
- Check Anthropic/OpenAI dashboards for API errors

---

## Quick Reference

### Essential Commands

```bash
# Development
npm run dev          # Start dev server on :3000
npm run build        # Production build
npm start            # Start production server

# Testing
npx playwright test           # Run E2E tests
npx playwright test --ui      # Run with UI
npx tsx tests/run-email-tests.ts  # Run AI integration tests

# Database
# Run migrations in Supabase SQL Editor
# Files: supabase/migrations/*.sql
```

### Key File Paths

```
src/app/page.tsx                      # App entry point
src/components/MainApp.tsx            # Main app shell
src/lib/supabase.ts                   # Supabase client
src/types/todo.ts                     # All TypeScript types
src/app/api/ai/generate-email/route.ts  # Email generation endpoint
supabase/migrations/                  # SQL migrations
```

### Important URLs

- **Production**: https://shared-todo-list-production.up.railway.app
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Railway Dashboard**: https://railway.app
- **Anthropic Console**: https://console.anthropic.com
- **OpenAI Console**: https://platform.openai.com

### Brand Colors (Allstate)

```css
--brand-blue: #0033A0
--sky-blue: #72B5E8
--gold: #C9A227
--navy: #003D7A
--muted-blue: #6E8AA7
```

### User Colors (8 total)

```typescript
const USER_COLORS = [
  '#0033A0',  // Brand Blue
  '#72B5E8',  // Sky Blue
  '#C9A227',  // Gold
  '#003D7A',  // Navy
  '#6E8AA7',  // Muted Blue
  '#5BA8A0',  // Teal
  '#E87722',  // Orange
  '#98579B'   // Purple
];
```

---

## Troubleshooting Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Real-time not syncing | Check table is in `supabase_realtime` publication |
| AI timeout | Verify `ANTHROPIC_API_KEY` is set and valid |
| File upload fails | Use `SUPABASE_SERVICE_ROLE_KEY` not anon key |
| Login fails | Check PIN hash matches (console log both) |
| Dark mode broken | Verify `ThemeContext` is wrapping app |
| Kanban drag broken | Check `@dnd-kit` version compatibility |
| Outlook add-in error | Verify `X-API-Key` header matches env var |
| Transcription fails | Check `OPENAI_API_KEY` is set |

---

## Best Practices for AI Assistants

When working on this codebase:

1. **Always read components before modifying** - Don't assume structure
2. **Preserve real-time subscriptions** - Don't break the subscription pattern
3. **Log activity for auditing** - Use `logActivity()` for all mutations
4. **Follow TypeScript strictly** - All types are in `src/types/todo.ts`
5. **Test real-time sync** - Open two browser tabs when testing
6. **Respect owner-only features** - Check `isOwner` for restricted features
7. **Use optimistic updates** - Update UI immediately, persist async
8. **Handle errors gracefully** - Always show user-friendly error messages
9. **Maintain brand colors** - Use Allstate color palette
10. **Test mobile responsiveness** - Use Chrome DevTools mobile view

---

## Refactoring Plan

### 📋 Comprehensive Improvement Roadmap

A **detailed 12-week plan** to address technical debt and architectural issues has been created. This zero-downtime refactoring plan includes:

**Key Improvements:**
- ✅ **OAuth 2.0 Authentication** (Google/Apple) alongside existing PIN system
- ✅ **Enhanced Security** (Argon2 hashing, server-side rate limiting, Row-Level Security)
- ✅ **Normalized Database Schema** (move from JSONB to proper relational tables)
- ✅ **Component Refactoring** (break 2,000+ line components into modular pieces)
- ✅ **State Management** (add Zustand for centralized state)
- ✅ **Comprehensive Testing** (achieve 80%+ test coverage)
- ✅ **Feature Flags** (gradual rollout without breaking existing functionality)

**See [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) for complete details.**

**Strategy:** All improvements use feature flags and dual-write patterns to ensure **zero user disruption** during migration. Old system continues working while new system is built in parallel.

**Timeline:** 12 weeks | **Risk:** Low | **Cost:** ~$36/month additional infrastructure

---

## Orchestrator Agent Guide

This section provides guidance for multi-agent orchestrator systems working on this codebase.

### Agent Roles & Responsibilities

| Agent Type | Primary Focus | Key Files |
|------------|---------------|-----------|
| **Backend Engineer** | API routes, database operations, server logic | `src/app/api/`, `src/lib/db/`, `supabase/migrations/` |
| **Frontend Engineer** | React components, UI/UX, state management | `src/components/`, `src/hooks/`, `src/store/` |
| **Code Reviewer** | Code quality, patterns, security review | All source files |
| **Security Reviewer** | Auth, validation, data protection | `src/lib/auth.ts`, `src/lib/fileValidator.ts`, `src/middleware.ts` |
| **Tech Lead** | Architecture decisions, refactoring, integration | `ORCHESTRATOR.md`, `REFACTORING_PLAN.md` |
| **Business Analyst** | Requirements, user workflows, feature specs | `PRD.md`, `docs/` |

### Critical Constraints

1. **Real-Time Sync is Critical**: Always clean up subscriptions in `useEffect` returns
2. **Activity Logging Required**: All mutations must call `logActivity()`
3. **Owner-Only Features**: Check `currentUser?.name === 'Derrick'` for restricted features
4. **Optimistic Updates**: Update UI first, persist async, rollback on error
5. **TypeScript Strict**: All types defined in `src/types/todo.ts`
6. **Tailwind Only**: No inline styles, use utility classes

### Before Making Changes

1. Read the relevant component/file first
2. Check for real-time subscription patterns
3. Understand the data flow (component → store → API → database → real-time → all clients)
4. Review related tests in `tests/`
5. Check if feature flags apply (`src/lib/featureFlags.ts`)

### Common Pitfalls to Avoid

| Pitfall | Why It's Bad | Correct Approach |
|---------|--------------|------------------|
| Forgetting activity logging | Audit trail is business requirement | Always call `logActivity()` after mutations |
| Not cleaning up subscriptions | Memory leaks, duplicate events | Return cleanup function in `useEffect` |
| Using anon key server-side | RLS blocks operations | Use `SUPABASE_SERVICE_ROLE_KEY` |
| Skipping optimistic updates | Poor UX, feels slow | Update local state first |
| Breaking TypeScript types | Runtime errors | Extend types in `src/types/todo.ts` |
| Ignoring mobile | 40% of users on mobile | Test with Chrome DevTools mobile view |

### Quick Reference: Key Patterns

```typescript
// Real-time subscription pattern
useEffect(() => {
  const channel = supabase.channel('name').on(...).subscribe();
  return () => supabase.removeChannel(channel);  // REQUIRED cleanup
}, []);

// Optimistic update pattern
const handleAction = async () => {
  setLocalState(newValue);           // Instant UI
  try {
    await supabase.from(...).update(...);
  } catch {
    setLocalState(oldValue);         // Rollback
  }
};

// Activity logging pattern
await logActivity({
  action: 'task_updated',
  todo_id: id,
  todo_text: text,
  user_name: currentUser.name,
  details: { from: old, to: new }
});
```

### Documentation Files

| File | Purpose | When to Read |
|------|---------|--------------|
| [ORCHESTRATOR.md](./ORCHESTRATOR.md) | Quick reference for orchestrator agents | First, for context |
| [CLAUDE.md](./CLAUDE.md) | Detailed developer guide | For deep implementation details |
| [PRD.md](./PRD.md) | Product requirements | For business context |
| [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) | Improvement roadmap | Before major changes |
| [SETUP.md](./SETUP.md) | Installation guide | For environment setup |
| [docs/](./docs/) | Architecture documents | For feature-specific context |

---

**Last Updated:** 2026-01-18
**Version:** 2.2
**Maintained by:** Development Team

For questions or issues, refer to this document first, then check:
- README.md for user-facing documentation
- SETUP.md for installation instructions
- tests/ directory for testing documentation
- **[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)** for improvement roadmap ⭐
- **[ORCHESTRATOR.md](./ORCHESTRATOR.md)** for multi-agent orchestrator context ⭐
