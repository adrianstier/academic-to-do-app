# Shared Todo List - Architecture Diagram

## System Overview

```
                                    SHARED TODO LIST ARCHITECTURE
    ================================================================================================

                                         ┌─────────────────┐
                                         │   End Users     │
                                         │  Derrick/Sefra  │
                                         └────────┬────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
           ┌───────────────┐            ┌───────────────┐            ┌───────────────┐
           │  Web Browser  │            │   iOS App     │            │ Outlook Add-in│
           │   (Next.js)   │            │   (Swift)     │            │   (Office.js) │
           └───────┬───────┘            └───────┬───────┘            └───────┬───────┘
                   │                            │                            │
    ===============│============================│============================│===============
                   │                            │                            │
                   └────────────────────────────┼────────────────────────────┘
                                                │
                                                ▼
    ┌───────────────────────────────────────────────────────────────────────────────────────┐
    │                                   NEXT.JS 16 APP                                       │
    │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                              PRESENTATION LAYER                                  │  │
    │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
    │  │  │  TodoList   │  │  ChatPanel  │  │  Dashboard  │  │  Strategic  │            │  │
    │  │  │  + Kanban   │  │  + DMs      │  │  + Charts   │  │  Dashboard  │            │  │
    │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │  │
    │  └─────────────────────────────────────────────────────────────────────────────────┘  │
    │                                          │                                             │
    │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                              STATE MANAGEMENT                                    │  │
    │  │  ┌─────────────────────────────────────────────────────────────────────────┐   │  │
    │  │  │                        Zustand Store (todoStore.ts)                      │   │  │
    │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │  │
    │  │  │  │  Todos   │  │  Users   │  │ Filters  │  │   Bulk   │  │ UI State │  │   │  │
    │  │  │  │  State   │  │  State   │  │  State   │  │  Actions │  │          │  │   │  │
    │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │  │
    │  │  └─────────────────────────────────────────────────────────────────────────┘   │  │
    │  └─────────────────────────────────────────────────────────────────────────────────┘  │
    │                                          │                                             │
    │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                                 API LAYER                                        │  │
    │  │  ┌───────────────────────────────────────────────────────────────────────────┐  │  │
    │  │  │                         /api Routes (17 endpoints)                         │  │  │
    │  │  │                                                                            │  │  │
    │  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │  │
    │  │  │  │   /api/ai   │  │ /api/outlook│  │ /api/goals  │  │/api/templates│      │  │  │
    │  │  │  │  (8 routes) │  │  (3 routes) │  │  (5 routes) │  │  (3 routes) │      │  │  │
    │  │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │  │  │
    │  │  └───────────────────────────────────────────────────────────────────────────┘  │  │
    │  └─────────────────────────────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
    ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
    │                                           │                                            │
    │                                   EXTERNAL SERVICES                                    │
    │                                           │                                            │
    │    ┌──────────────────────────────────────┼──────────────────────────────────────┐   │
    │    │                                      │                                       │   │
    │    ▼                                      ▼                                       ▼   │
    │  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐  │
    │  │       SUPABASE         │  │     ANTHROPIC API      │  │     OPENAI API         │  │
    │  │  ┌──────────────────┐  │  │  ┌──────────────────┐  │  │  ┌──────────────────┐  │  │
    │  │  │   PostgreSQL     │  │  │  │  Claude Sonnet   │  │  │  │  Whisper API     │  │  │
    │  │  │   (9 tables)     │  │  │  │                  │  │  │  │  (Transcription) │  │  │
    │  │  ├──────────────────┤  │  │  │  - Smart Parse   │  │  │  └──────────────────┘  │  │
    │  │  │   Real-time      │  │  │  │  - Enhance Task  │  │  └────────────────────────┘  │
    │  │  │   (WebSocket)    │  │  │  │  - Email Gen     │  │                              │
    │  │  ├──────────────────┤  │  │  │  - Breakdown     │  │                              │
    │  │  │   Storage        │  │  │  └──────────────────┘  │                              │
    │  │  │   (Attachments)  │  │  └────────────────────────┘                              │
    │  │  └──────────────────┘  │                                                          │
    │  └────────────────────────┘                                                          │
    │                                                                                       │
    └───────────────────────────────────────────────────────────────────────────────────────┘


    ================================================================================================
```

---

## Data Flow Diagram

```
    DATA FLOW: Creating a Task with AI Smart Parse
    ================================================================================================

    ┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
    │   User   │────▶│  SmartParse  │────▶│  /api/ai/     │────▶│  Anthropic   │
    │  Input   │     │   Modal      │     │  smart-parse  │     │   Claude     │
    └──────────┘     └──────────────┘     └───────────────┘     └──────────────┘
                                                                        │
                                                                        ▼
    ┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
    │   All    │◀────│  Real-time   │◀────│   Supabase    │◀────│   Parsed     │
    │  Clients │     │  Broadcast   │     │   PostgreSQL  │     │   Task       │
    └──────────┘     └──────────────┘     └───────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Activity    │
                     │   Logged     │
                     └──────────────┘

    ================================================================================================
```

---

## Component Hierarchy

```
    COMPONENT TREE
    ================================================================================================

    page.tsx (Auth Gate)
    │
    ├─── LoginScreen (if !authenticated)
    │    ├── UserCard (for each registered user)
    │    ├── PinInput
    │    └── RegisterForm
    │
    └─── MainApp (if authenticated)
         │
         ├── Header
         │   ├── Logo
         │   ├── Navigation (Dashboard | Tasks | Chat | Goals)
         │   ├── UserSwitcher
         │   └── ThemeToggle
         │
         ├── Dashboard (view === 'dashboard')
         │   ├── ProgressSummary
         │   │   ├── StatCard (Total)
         │   │   ├── StatCard (Completed)
         │   │   ├── StatCard (Overdue)
         │   │   └── StatCard (Due Today)
         │   └── WeeklyProgressChart
         │
         ├── TodoList (view === 'tasks')
         │   │
         │   ├── TodoHeader
         │   │   ├── FilterBar
         │   │   ├── ViewToggle (List | Kanban)
         │   │   └── BulkActionBar
         │   │
         │   ├── AddTodo
         │   │   ├── QuickTaskButtons
         │   │   ├── SmartParseModal
         │   │   │   └── AI Parsing UI
         │   │   ├── TemplatePicker
         │   │   └── SaveTemplateModal
         │   │
         │   ├── [List View]
         │   │   └── TodoItem (for each task)
         │   │       ├── Checkbox
         │   │       ├── TaskText
         │   │       ├── PriorityBadge
         │   │       ├── DueDateBadge
         │   │       ├── AssigneeBadge
         │   │       ├── SubtaskProgress
         │   │       ├── AttachmentList
         │   │       ├── ActionButtons
         │   │       └── Modals
         │   │           ├── DuplicateDetectionModal
         │   │           └── CustomerEmailModal
         │   │
         │   └── [Kanban View]
         │       └── KanbanBoard
         │           ├── Column (Todo)
         │           │   └── SortableTodoItem[]
         │           ├── Column (In Progress)
         │           │   └── SortableTodoItem[]
         │           └── Column (Done)
         │               └── SortableTodoItem[]
         │
         ├── ChatPanel (view === 'chat')
         │   ├── ChatHeader
         │   │   ├── ChannelTabs (Team | DMs)
         │   │   └── OnlineIndicator
         │   ├── MessageList
         │   │   └── Message (for each message)
         │   │       ├── Avatar
         │   │       ├── MessageText
         │   │       ├── Reactions
         │   │       ├── ReplyThread
         │   │       └── ActionMenu
         │   ├── MessageInput
         │   │   ├── TextArea
         │   │   ├── VoiceRecordingIndicator
         │   │   └── SendButton
         │   └── TypingIndicator
         │
         ├── StrategicDashboard (view === 'goals', owner only)
         │   ├── GoalCategories
         │   │   └── CategoryCard[]
         │   ├── GoalList
         │   │   └── GoalCard (for each goal)
         │   │       ├── ProgressBar
         │   │       ├── Milestones
         │   │       └── ActionButtons
         │   └── GoalEditor
         │
         ├── ActivityFeed (sidebar)
         │   └── ActivityItem[]
         │
         └── Global Modals
             ├── CelebrationEffect
             ├── KeyboardShortcutsModal
             ├── ConfirmDialog
             └── PullToRefresh

    ================================================================================================
```

---

## Database Schema

```
    DATABASE SCHEMA (9 Tables)
    ================================================================================================

    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         USERS                                                │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │  id (UUID, PK)                                                                              │
    │  name (TEXT, UNIQUE)                                                                        │
    │  pin_hash (TEXT)                         ◀─── SHA-256 hash                                  │
    │  color (TEXT)                            ◀─── Hex color for UI                              │
    │  created_at, last_login                                                                     │
    │  streak_count, streak_last_date                                                             │
    │  welcome_shown_at                                                                            │
    └───────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                │
                                                │ 1:N
                                                ▼
    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                         TODOS                                                │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │  id (UUID, PK)                                                                              │
    │  text (TEXT)                                                                                │
    │  completed (BOOLEAN)                                                                        │
    │  status (TEXT)                           ◀─── 'todo' | 'in_progress' | 'done'               │
    │  priority (TEXT)                         ◀─── 'low' | 'medium' | 'high' | 'urgent'         │
    │  created_at, created_by                                                                     │
    │  assigned_to                             ◀─── User name (FK conceptual)                     │
    │  due_date, notes, recurrence                                                                │
    │  subtasks (JSONB)                        ◀─── [{id, text, completed, priority}]             │
    │  attachments (JSONB)                     ◀─── [{id, file_name, storage_path, ...}]          │
    │  transcription, merged_from                                                                  │
    │  updated_at, updated_by                                                                      │
    └───────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              │ 1:N             │ 1:N             │ 1:N
                              ▼                 ▼                 ▼
    ┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────────┐
    │        MESSAGES              │  │      ACTIVITY_LOG           │  │    Supabase Storage         │
    ├─────────────────────────────┤  ├─────────────────────────────┤  ├─────────────────────────────┤
    │  id (UUID, PK)              │  │  id (UUID, PK)              │  │  todos/{task_id}/           │
    │  text (TEXT)                │  │  action (TEXT)              │  │    {filename}               │
    │  created_by, created_at     │  │  todo_id (UUID, FK)         │  │                             │
    │  recipient                  │  │  todo_text                  │  │                             │
    │  related_todo_id (UUID, FK) │  │  user_name                  │  │                             │
    │  reactions (JSONB)          │  │  details (JSONB)            │  │                             │
    │  read_by (TEXT[])           │  │  created_at                 │  │                             │
    │  reply_to_id, reply_to_*    │  └─────────────────────────────┘  └─────────────────────────────┘
    │  edited_at, deleted_at      │
    │  is_pinned, pinned_by       │
    │  mentions (TEXT[])          │
    └─────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                    TASK_TEMPLATES                                            │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │  id (UUID, PK)                                                                              │
    │  name, description                                                                          │
    │  default_priority, default_assigned_to                                                      │
    │  subtasks (JSONB)                                                                           │
    │  created_by, is_shared                                                                      │
    │  created_at, updated_at                                                                     │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                    DEVICE_TOKENS                                             │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │  id (UUID, PK)                                                                              │
    │  user_id (UUID, FK)          ───────────▶ users.id                                          │
    │  token (TEXT, UNIQUE)                                                                       │
    │  platform (TEXT)                         ◀─── 'ios' | 'android' | 'web'                     │
    │  created_at, updated_at                                                                     │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────┐           ┌─────────────────────────────┐
    │     GOAL_CATEGORIES         │           │      STRATEGIC_GOALS        │
    ├─────────────────────────────┤   1:N     ├─────────────────────────────┤
    │  id (UUID, PK)              │◀─────────▶│  id (UUID, PK)              │
    │  name (TEXT, UNIQUE)        │           │  title, description         │
    │  color (TEXT)               │           │  category_id (UUID, FK)     │
    │  icon (TEXT)                │           │  status, priority           │
    │  display_order              │           │  target_date                │
    │  created_at                 │           │  target_value, current_value│
    └─────────────────────────────┘           │  progress_percent           │
                                              │  notes, display_order       │
                                              │  created_by                 │
                                              │  created_at, updated_at     │
                                              └───────────────┬─────────────┘
                                                              │
                                                              │ 1:N
                                                              ▼
                                              ┌─────────────────────────────┐
                                              │      GOAL_MILESTONES        │
                                              ├─────────────────────────────┤
                                              │  id (UUID, PK)              │
                                              │  goal_id (UUID, FK)         │
                                              │  title (TEXT)               │
                                              │  completed (BOOLEAN)        │
                                              │  target_date                │
                                              │  display_order              │
                                              │  created_at                 │
                                              └─────────────────────────────┘

    ================================================================================================
```

---

## Real-Time Data Flow

```
    REAL-TIME SYNCHRONIZATION
    ================================================================================================

    Client A (Browser)              Supabase                    Client B (Browser)
    ─────────────────────           ─────────                   ─────────────────────

         ┌─────────┐                    │                            ┌─────────┐
         │ Update  │                    │                            │ Subscribed│
         │  Task   │                    │                            │ to todos │
         └────┬────┘                    │                            └─────────┘
              │                         │                                  │
              │  1. INSERT/UPDATE       │                                  │
              │─────────────────────────▶                                  │
              │                         │                                  │
              │                    ┌────┴────┐                             │
              │                    │ Database│                             │
              │                    │  Write  │                             │
              │                    └────┬────┘                             │
              │                         │                                  │
              │                    ┌────┴────┐                             │
              │                    │ Realtime│                             │
              │                    │ Broadcast│                            │
              │                    └────┬────┘                             │
              │                         │                                  │
              │                         │  2. postgres_changes event       │
              │                         │─────────────────────────────────▶│
              │                         │                                  │
              │                         │                           ┌──────┴──────┐
              │                         │                           │ Update Local│
              │                         │                           │    State    │
              │                         │                           └──────┬──────┘
              │                         │                                  │
              │                         │                           ┌──────┴──────┐
              │                         │                           │  Re-render  │
              │                         │                           │     UI      │
              │                         │                           └─────────────┘


    Tables with Real-Time Enabled:
    ─────────────────────────────
    ✅ todos
    ✅ messages
    ✅ activity_log
    ✅ strategic_goals
    ✅ goal_milestones

    ================================================================================================
```

---

## Authentication Flow

```
    AUTHENTICATION (PIN-BASED)
    ================================================================================================

    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                    REGISTRATION                                              │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘

    User                    Client (Browser)                 Supabase
    ────                    ────────────────                 ────────
      │                           │                             │
      │  Enter name + 4-digit PIN │                             │
      │──────────────────────────▶│                             │
      │                           │                             │
      │                     ┌─────┴─────┐                       │
      │                     │  SHA-256  │                       │
      │                     │   Hash    │                       │
      │                     └─────┬─────┘                       │
      │                           │                             │
      │                           │  INSERT { name, pin_hash,   │
      │                           │          color }             │
      │                           │────────────────────────────▶│
      │                           │                             │
      │                           │  { id, name, color }        │
      │                           │◀────────────────────────────│
      │                           │                             │
      │                     ┌─────┴─────┐                       │
      │                     │ localStorage│                     │
      │                     │  session   │                      │
      │                     └─────┬─────┘                       │
      │                           │                             │
      │  ✅ Logged In             │                             │
      │◀──────────────────────────│                             │


    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                      LOGIN                                                   │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘

    User                    Client (Browser)                 Supabase
    ────                    ────────────────                 ────────
      │                           │                             │
      │  Select user + enter PIN  │                             │
      │──────────────────────────▶│                             │
      │                           │                             │
      │                     ┌─────┴─────┐                       │
      │                     │  SHA-256  │                       │
      │                     │   Hash    │                       │
      │                     └─────┬─────┘                       │
      │                           │                             │
      │                           │  SELECT WHERE id = ?        │
      │                           │    AND pin_hash = ?         │
      │                           │────────────────────────────▶│
      │                           │                             │
      │                           │  { user } or null           │
      │                           │◀────────────────────────────│
      │                           │                             │
      │                     ┌─────┴─────┐                       │
      │                     │  Match?   │                       │
      │                     └─────┬─────┘                       │
      │                           │                             │
      │        ┌──────────────────┼──────────────────┐          │
      │        │ YES              │                   │ NO      │
      │        ▼                  │                   ▼         │
      │  ┌──────────┐             │            ┌──────────┐     │
      │  │ Session  │             │            │ Increment│     │
      │  │ Created  │             │            │ Lockout  │     │
      │  └──────────┘             │            └──────────┘     │
      │                           │                   │         │
      │                           │            ┌──────┴─────┐   │
      │                           │            │ 3 fails =  │   │
      │                           │            │ 30s lockout│   │
      │                           │            └────────────┘   │

    ================================================================================================
```

---

## API Endpoint Map

```
    API ROUTES (/api/*)
    ================================================================================================

    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                    AI ENDPOINTS                                              │
    │                                    /api/ai/*                                                 │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                             │
    │  POST /api/ai/smart-parse           ───▶  Natural language → task + subtasks               │
    │  POST /api/ai/enhance-task          ───▶  Improve task clarity, extract metadata           │
    │  POST /api/ai/breakdown-task        ───▶  Generate subtasks for complex task               │
    │  POST /api/ai/transcribe            ───▶  Audio → text (Whisper)                           │
    │  POST /api/ai/parse-voicemail       ───▶  Voicemail → actionable task                      │
    │  POST /api/ai/parse-file            ───▶  Document → extracted tasks                       │
    │  POST /api/ai/parse-content-to-subtasks ─▶ Bullet points → subtasks                        │
    │  POST /api/ai/generate-email        ───▶  Tasks → customer email                           │
    │                                                                                             │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                  OUTLOOK ENDPOINTS                                           │
    │                                  /api/outlook/*                                              │
    │                                  (Requires X-API-Key header)                                 │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                             │
    │  GET  /api/outlook/users            ───▶  List users for add-in                            │
    │  POST /api/outlook/parse-email      ───▶  Email → task details                             │
    │  POST /api/outlook/create-task      ───▶  Create task from Outlook                         │
    │                                                                                             │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │                                  DATA ENDPOINTS                                              │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                             │
    │  GET    /api/templates              ───▶  Fetch user's templates                           │
    │  POST   /api/templates              ───▶  Create template                                  │
    │  DELETE /api/templates              ───▶  Delete template                                  │
    │                                                                                             │
    │  GET    /api/activity               ───▶  Fetch activity log                               │
    │  POST   /api/activity               ───▶  Log activity                                     │
    │                                                                                             │
    │  POST   /api/attachments            ───▶  Upload file                                      │
    │                                                                                             │
    │  GET    /api/goals                  ───▶  Fetch goals                                      │
    │  POST   /api/goals                  ───▶  Create goal                                      │
    │  PUT    /api/goals/:id              ───▶  Update goal                                      │
    │  DELETE /api/goals/:id              ───▶  Delete goal                                      │
    │                                                                                             │
    │  GET    /api/goals/categories       ───▶  Fetch categories                                 │
    │  POST   /api/goals/categories       ───▶  Create category                                  │
    │                                                                                             │
    │  GET    /api/goals/milestones       ───▶  Fetch milestones                                 │
    │  POST   /api/goals/milestones       ───▶  Create milestone                                 │
    │                                                                                             │
    │  GET    /api/patterns/analyze       ───▶  Analyze task patterns                            │
    │  POST   /api/patterns/analyze       ───▶  Run pattern analysis                             │
    │  GET    /api/patterns/suggestions   ───▶  Get pattern suggestions                          │
    │                                                                                             │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘

    ================================================================================================
```

---

## Deployment Architecture

```
    DEPLOYMENT (Railway + Supabase)
    ================================================================================================

                              ┌───────────────────────────────────────┐
                              │              GITHUB                    │
                              │         (Source Control)               │
                              └───────────────────┬───────────────────┘
                                                  │
                                                  │ Push to main
                                                  │
                                                  ▼
                              ┌───────────────────────────────────────┐
                              │              RAILWAY                   │
                              │         (Container Host)               │
                              │                                        │
                              │  ┌─────────────────────────────────┐  │
                              │  │         Docker Container         │  │
                              │  │                                  │  │
                              │  │  ┌──────────────────────────┐  │  │
                              │  │  │      Next.js 16 App       │  │  │
                              │  │  │                           │  │  │
                              │  │  │  • SSR/SSG Pages          │  │  │
                              │  │  │  • API Routes             │  │  │
                              │  │  │  • Static Assets          │  │  │
                              │  │  └──────────────────────────┘  │  │
                              │  │                                  │  │
                              │  │  Environment Variables:          │  │
                              │  │  • NEXT_PUBLIC_SUPABASE_URL     │  │
                              │  │  • NEXT_PUBLIC_SUPABASE_ANON_KEY│  │
                              │  │  • SUPABASE_SERVICE_ROLE_KEY    │  │
                              │  │  • ANTHROPIC_API_KEY            │  │
                              │  │  • OPENAI_API_KEY               │  │
                              │  │  • OUTLOOK_ADDON_API_KEY        │  │
                              │  └─────────────────────────────────┘  │
                              │                                        │
                              │  URL: https://shared-todo-list-       │
                              │       production.up.railway.app        │
                              └───────────────────┬───────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
    ┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
    │        SUPABASE           │  │       ANTHROPIC           │  │        OPENAI             │
    │                           │  │                           │  │                           │
    │  • PostgreSQL Database    │  │  • Claude Sonnet API      │  │  • Whisper API            │
    │  • Real-time WebSocket    │  │  • Task parsing           │  │  • Audio transcription    │
    │  • File Storage (S3)      │  │  • Email generation       │  │                           │
    │  • Edge Functions         │  │  • Task enhancement       │  │                           │
    │                           │  │                           │  │                           │
    └───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘

    ================================================================================================
```

---

## Feature Flags System

```
    FEATURE FLAGS (Gradual Rollout)
    ================================================================================================

    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
    │  src/lib/featureFlags.ts                                                                    │
    ├─────────────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                             │
    │  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
    │  │  Flag Name              │  Purpose                      │  Status                    │  │
    │  ├──────────────────────────────────────────────────────────────────────────────────────┤  │
    │  │  normalized_schema      │  Use relational tables        │  In Progress               │  │
    │  │  oauth_support          │  Google/Apple login           │  In Progress               │  │
    │  │  row_level_security     │  Database-level RLS           │  Planned                   │  │
    │  └──────────────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                             │
    │  Usage:                                                                                     │
    │  ───────                                                                                    │
    │  import { isFeatureEnabled } from '@/lib/featureFlags';                                    │
    │                                                                                             │
    │  if (isFeatureEnabled('normalized_schema')) {                                              │
    │    // Use new normalized tables                                                            │
    │  } else {                                                                                   │
    │    // Use JSONB embedded data                                                              │
    │  }                                                                                          │
    │                                                                                             │
    │  Environment Variables:                                                                     │
    │  ─────────────────────                                                                      │
    │  NEXT_PUBLIC_ENABLE_OAUTH=true                                                             │
    │  NEXT_PUBLIC_ENABLE_RLS=false                                                              │
    │  NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA=true                                                 │
    │                                                                                             │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘

    ================================================================================================
```

---

*Last Updated: 2026-01-18*
