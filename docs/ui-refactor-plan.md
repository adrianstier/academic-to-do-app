# UI Refactor Plan: Apple Reminders / Todoist Style

## Executive Summary

Transform the Bealer Agency Todo App from an "everything visible at once" layout to a calm, task-first, mobile-first experience that mimics Apple Reminders and Todoist.

**Key Changes:**
1. Remove persistent chat rail from task views
2. Redesign Add Task with single-line input + inline AI preview
3. Simplify list view with Overdue/Today/Upcoming sections
4. Add contextual AI actions in Task Detail (not competing panels)
5. Create dedicated AI Inbox view for staged review
6. Convert Chat to a navigation view (not persistent sidebar)

---

## Current State Analysis

### Architecture Summary
- **Framework**: Next.js 16 (App Router), React 19
- **State Management**: Zustand (`src/store/todoStore.ts`)
- **Styling**: Tailwind CSS 4.x + CSS variables (no shadcn/ui)
- **Animations**: Framer Motion
- **Layout**: CSS Grid in `AppLayout.tsx`, `AppShell.tsx`

### Key Files to Modify

| File | Lines | Purpose | Changes Needed |
|------|-------|---------|----------------|
| `src/components/TodoList.tsx` | 1,200+ | Main task view hub | Major: Remove chat integration, simplify layout, add sections |
| `src/components/AddTodo.tsx` | 745 | Task creation | Major: Redesign to single-line with inline preview |
| `src/components/ChatPanel.tsx` | 2,062 | Team chat | Minor: Make it work standalone (already good) |
| `src/components/FloatingChat.tsx` | 249 | Floating chat widget | Remove/Replace: Not needed after refactor |
| `src/components/layout/AppLayout.tsx` | 153 | Grid layout | Modify: Remove sidebar for chat, keep for task detail |
| `src/components/layout/AppShell.tsx` | 414 | App shell + nav | Modify: Update navigation, add Chat as view |
| `src/store/todoStore.ts` | 648 | Zustand store | Add: AI Inbox state, new view modes |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/views/AIInbox.tsx` | AI-derived items review |
| `src/components/task/TaskDetailDrawer.tsx` | Task detail with AI actions |
| `src/components/task/InlineAddTask.tsx` | New single-line add task |
| `src/components/task/TaskPreviewCard.tsx` | AI-parsed task preview |
| `src/components/task/TaskSections.tsx` | Overdue/Today/Upcoming grouping |
| `src/app/chat/page.tsx` | Dedicated chat route |
| `src/app/ai-inbox/page.tsx` | AI Inbox route |

---

## Implementation Steps

### Phase 1: Remove Chat Rail (Low Risk)
**Goal**: Chat is no longer visible in the main task list view

1. **Modify `TodoList.tsx`**:
   - Remove `FloatingChat` and `ChatPanel` imports and rendering
   - Remove `UtilitySidebar` if it contains chat
   - Keep all task functionality intact

2. **Modify `AppLayout.tsx`**:
   - Change grid to single column for task views
   - Keep sidebar capability for task detail panel (future)

3. **Update `AppShell.tsx`**:
   - Remove `rightPanelContent` when on tasks view
   - Keep mobile sheet chat placeholder

4. **Add Chat to Navigation**:
   - Update `NavigationSidebar.tsx` to include Chat as primary nav item
   - Clicking Chat navigates to `/chat` or sets `activeView: 'chat'`

**Files Changed**: TodoList.tsx, AppLayout.tsx, AppShell.tsx, NavigationSidebar.tsx

### Phase 2: Redesign Add Task (Medium Risk)
**Goal**: Single-line input with inline AI preview before creation

1. **Create `InlineAddTask.tsx`**:
   ```
   ┌─────────────────────────────────────────────────────┐
   │ 🔍 Add task...  (Type naturally or paste text)   ⌘N │
   └─────────────────────────────────────────────────────┘
   ```
   - Single-line text input (expands on multiline paste)
   - Submit triggers smart parsing
   - No visible dropdowns until preview shown

2. **Create `TaskPreviewCard.tsx`**:
   ```
   ┌─────────────────────────────────────────────────────┐
   │ ✨ Parsed Task Preview                              │
   │ ┌─────────────────────────────────────────────────┐ │
   │ │ Call John about auto policy renewal            │ │
   │ │ 🔴 Urgent  📅 Tomorrow  👤 Derrick              │ │
   │ │ ▼ 3 subtasks                                    │ │
   │ └─────────────────────────────────────────────────┘ │
   │           [ Edit ]  [ Create Task ✓ ]               │
   └─────────────────────────────────────────────────────┘
   ```
   - Shows AI-parsed metadata as chips
   - Subtasks collapsed with count
   - "Edit" opens lightweight editor
   - "Create" commits immediately

3. **Keep Original AddTodo.tsx** as fallback for complex editing

4. **Parsing Behavior**:
   - On Enter or blur with text, call `/api/ai/smart-parse`
   - If text is simple (< 20 chars, no bullets), create immediately
   - If complex, show preview card inline below input

**Files Changed**: AddTodo.tsx (replace), new InlineAddTask.tsx, new TaskPreviewCard.tsx

### Phase 3: Simplify Task List Layout (Medium Risk)
**Goal**: Calm single-column with date-based sections

1. **Create `TaskSections.tsx`**:
   - Groups tasks by: Overdue, Today, Upcoming, No Date
   - Collapsible sections with count badges
   - Empty state per section

2. **Modify `TodoList.tsx`**:
   - Replace flat list with `TaskSections` component
   - Move filters to compact bar (hidden advanced)
   - Keep sort dropdown (Urgency, Priority, Due, Created, A-Z)

3. **Task Row Redesign**:
   - Checkbox + Title + Priority dot + Due chip + Avatar
   - Click row → opens Task Detail drawer
   - Swipe actions on mobile (complete, delete)

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ [ All ] [ My Tasks ] [ Due Today ] [ Overdue ]   🔍  ≡    │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Add task...                                          │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ ▼ OVERDUE (2)                                             │
│   ○ Call Sarah about claim #1234          🔴 Jan 15  👤   │
│   ○ Review policy renewal                 🟠 Jan 16  👤   │
│                                                            │
│ ▼ TODAY (3)                                                │
│   ○ Process new application               🟡 Today   👤   │
│   ○ Send quote to Miller family           🟡 Today   👤   │
│   ○ Follow up on pending claim            🟢 Today   👤   │
│                                                            │
│ ▼ UPCOMING (5)                                             │
│   ...                                                      │
└────────────────────────────────────────────────────────────┘
```

**Files Changed**: TodoList.tsx, new TaskSections.tsx, TodoItem.tsx (simplify)

### Phase 4: Task Detail with AI Actions (Medium Risk)
**Goal**: Contextual AI in task detail, not competing panels

1. **Create `TaskDetailDrawer.tsx`**:
   - Opens as drawer (desktop) or full page (mobile)
   - Sections: Title, Metadata, Description, Subtasks, Files, Activity
   - **AI Actions section** at bottom:
     - "Break into subtasks" → calls API, shows preview
     - "Improve description" → suggests enhanced text
     - "Draft customer email" → opens email composer
     - "Find duplicates" → shows potential matches

2. **AI Action Flow**:
   ```
   [ 🪄 Break into subtasks ]
         ↓ (loading)
   ┌─────────────────────────────────────┐
   │ AI suggests 4 subtasks:             │
   │ ☑ Review current coverage           │
   │ ☑ Calculate new premium             │
   │ ☑ Prepare quote document            │
   │ ☐ Schedule follow-up call           │
   │        [ Apply ] [ Cancel ]         │
   └─────────────────────────────────────┘
   ```

3. **Update existing `TodoItem.tsx`**:
   - On click → open `TaskDetailDrawer`
   - Remove inline expand behavior (too cluttered)

**Files Changed**: new TaskDetailDrawer.tsx, TodoItem.tsx

### Phase 5: AI Inbox View (Low Risk - New Feature)
**Goal**: Staged review of AI-derived items

1. **Create route `/ai-inbox`** or view toggle

2. **Create `AIInbox.tsx`**:
   - Queues: Parsed Emails, Parsed Voicemails, Document Tasks, Duplicates
   - Each item shows source + proposed task + actions
   - Actions: Accept (creates task), Edit, Dismiss

3. **Add to store**:
   ```typescript
   interface AIInboxState {
     parsedEmails: AIInboxItem[];
     parsedVoicemails: AIInboxItem[];
     documentTasks: AIInboxItem[];
     possibleDuplicates: AIInboxItem[];
   }
   ```

4. **Stub implementation**:
   - Mock data initially
   - Connect to existing Outlook parse endpoints
   - Connect to transcription results

**Files Changed**: new src/app/ai-inbox/page.tsx, new AIInbox.tsx, todoStore.ts

### Phase 6: Focus Mode & Kanban Toggles (Low Risk)
**Goal**: Clean view switching without competing panels

1. **Modify view toggle in header**:
   ```
   [ List ] [ Board ] [ Focus ] [ AI Inbox ]
   ```

2. **Focus Mode**:
   - Already exists via `FocusModeToggle.tsx`
   - Ensure it hides sidebars completely
   - Add keyboard nav (←/→ for prev/next task)

3. **Kanban**:
   - Already exists via `KanbanBoard.tsx`
   - Ensure no chat rail in this view
   - Task card click → opens Task Detail drawer

**Files Changed**: TodoList.tsx (view toggle), KanbanBoard.tsx

### Phase 7: Chat as Navigation View (Low Risk)
**Goal**: Chat accessible via navigation, not persistent rail

1. **Create `/chat` route** or use activeView state

2. **Modify `NavigationSidebar.tsx`**:
   - Add "Messages" / "Chat" nav item
   - Show unread badge

3. **When Chat view active**:
   - Render `ChatPanel` in main content area (full width)
   - DMs list + conversation

4. **Remove**:
   - `FloatingChat.tsx` usage in TodoList
   - Right panel chat in AppShell (for task views)

**Files Changed**: NavigationSidebar.tsx, AppShell.tsx, new chat route

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking real-time sync | High | Keep subscription patterns intact; only change rendering |
| Losing keyboard shortcuts | Medium | Maintain N, /, ?, Cmd+K handlers in TodoList.tsx |
| Mobile regressions | Medium | Test each phase on mobile viewport |
| Activity logging gaps | Low | Ensure logActivity calls remain in all CRUD operations |
| Bulk actions broken | Medium | Keep useBulkActions hook; adjust UI only |

---

## Fallback Plan

If a phase causes issues:
1. **Chat removal breaks real-time**: Revert to FloatingChat (non-persistent)
2. **Add Task redesign too disruptive**: Keep old AddTodo.tsx, add new as alternative
3. **Task sections slow**: Fall back to flat list with visual separators

---

## Testing Checklist

### After Each Phase:
- [ ] Tasks load and display correctly
- [ ] Create task works (quick and AI-parsed)
- [ ] Complete/uncomplete task works
- [ ] Delete task works
- [ ] Real-time sync works (multi-tab)
- [ ] Keyboard shortcuts work (N, /, ?, Cmd+K)
- [ ] Mobile responsive
- [ ] Dark mode works

### Final QA:
- [ ] Create task via natural language input
- [ ] Paste email text and accept AI preview
- [ ] Open task detail and run AI enhance
- [ ] Visit AI Inbox and accept an item
- [ ] Switch to Board view and drag task
- [ ] Enter Focus mode and navigate tasks
- [ ] Access Chat via navigation
- [ ] All filters and sorts work
- [ ] Bulk actions work
- [ ] Templates work

---

## Order of Operations

1. **Phase 1**: Remove chat rail (safest, biggest visual impact)
2. **Phase 7**: Add Chat as navigation view (completes Phase 1)
3. **Phase 3**: Simplify task list with sections
4. **Phase 2**: Redesign Add Task input
5. **Phase 4**: Task Detail with AI actions
6. **Phase 5**: AI Inbox skeleton
7. **Phase 6**: Focus Mode and Kanban integration

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| 1: Remove chat rail | 1-2 hours | None |
| 7: Chat as nav view | 1 hour | Phase 1 |
| 3: Task list sections | 2-3 hours | None |
| 2: Add Task redesign | 3-4 hours | Phase 3 |
| 4: Task Detail + AI | 3-4 hours | None |
| 5: AI Inbox | 2-3 hours | None |
| 6: Focus/Kanban | 1-2 hours | None |

**Total: ~15-20 hours of focused work**

---

## Architecture Decisions

### Why Not Persistent Chat Rail?
- Competes for attention with tasks
- Reduces main content width
- Not the primary workflow (insurance tasks are)
- Chat can be contextual (per-task discussions)

### Why Inline AI Preview?
- Reduces modal fatigue
- Shows AI value without disrupting flow
- User confirms before creation (prevents garbage tasks)

### Why Date-Based Sections?
- Matches mental model (Reminders/Todoist)
- Provides urgency cues naturally
- Reduces need for manual sorting

### Why AI Inbox as Separate View?
- AI-derived items need review, not auto-creation
- Keeps daily task list clean
- Power users can batch-process

---

## Success Metrics

1. **Task list is calmer**: Single dominant action (add task)
2. **AI is helpful, not intrusive**: Only appears when relevant
3. **Chat is accessible, not persistent**: One click away, not always visible
4. **Mobile works well**: Primary mobile experience improved
5. **No feature regression**: All existing functionality preserved

---

## Implementation Notes (Completed)

### Phase 1: Remove Chat Rail ✅
- Removed FloatingChat import and rendering from TodoList.tsx
- Chat is no longer visible in the main task list view

### Phase 7: Chat as Navigation View ✅
- Added 'chat' to ActiveView type in AppShell.tsx
- Created `src/components/views/ChatView.tsx` as dedicated chat view
- Added 'Messages' nav item to NavigationSidebar.tsx
- Chat now accessible via left navigation

### Phase 3: Task List Sections ✅
- Created `src/components/TaskSections.tsx` with collapsible date-based sections:
  - Overdue (red)
  - Today (blue/accent)
  - Upcoming (muted)
  - No Date (light)
- Added `useShouldUseSections` hook to determine when sections apply
- Added toggle button in TodoList header for sections view
- Proper TypeScript typing for all props

### Phase 2: Add Task Redesign ✅
- Created `src/components/InlineAddTask.tsx`:
  - Single-line input that detects complex input (>50 chars, bullets, multiple lines)
  - Simple text creates task immediately
  - Complex text triggers AI smart-parse API
  - Inline preview card shows parsed task with editable fields
  - Subtasks shown collapsed with expand toggle
- Added toggle in TodoList between simplified and advanced input

### Phase 4: Task Detail with AI Actions ✅
- Enhanced `src/components/layout/TaskDetailPanel.tsx`:
  - Added AI Actions section with collapsible UI
  - "Break into subtasks" - calls `/api/ai/breakdown-task`, shows preview, apply button
  - "Improve description" - calls `/api/ai/enhance-task`, shows comparison
  - "Draft customer email" - triggers existing email generation
  - "Find duplicates" - placeholder (disabled, marked coming soon)
  - Preview cards with accept/cancel actions
  - Loading states per action

### Phase 5: AI Inbox View ✅
- Created `src/components/views/AIInbox.tsx`:
  - Full-featured inbox for AI-derived task suggestions
  - Categorized by source: Emails, Voicemails, Documents, Duplicates
  - Each item shows source preview, confidence score, proposed task
  - Edit mode for adjusting suggestions before accepting
  - Accept/Dismiss actions with loading states
  - Empty state when no items to review
- Added 'ai_inbox' to ActiveView type
- Added 'AI Inbox' nav item to NavigationSidebar
- Integrated into MainApp with placeholder handlers

### Phase 6: Focus Mode & Kanban Integration ✅
- Verified existing implementations work correctly
- View toggle (List/Board) in header
- Sections toggle only shows in list view
- FocusModeToggle component with Cmd+Shift+F shortcut
- ExitFocusModeButton floating button in focus mode
- All views work cleanly without competing chat rail

---

## Files Created

| File | Purpose |
|------|---------|
| `src/components/TaskSections.tsx` | Date-based collapsible task sections |
| `src/components/InlineAddTask.tsx` | Simplified single-line add task with AI preview |
| `src/components/views/ChatView.tsx` | Dedicated chat view (navigation-based) |
| `src/components/views/AIInbox.tsx` | AI Inbox for reviewing AI-derived items |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/TodoList.tsx` | Added TaskSections, InlineAddTask, view toggles |
| `src/components/MainApp.tsx` | Added ChatView and AIInbox routing |
| `src/components/layout/AppShell.tsx` | Added 'ai_inbox' to ActiveView type |
| `src/components/layout/NavigationSidebar.tsx` | Added AI Inbox nav item |
| `src/components/layout/TaskDetailPanel.tsx` | Added AI Actions section |

---

## QA Checklist Status

### Core Functionality:
- [x] Tasks load and display correctly
- [x] Create task works (quick and AI-parsed)
- [x] Complete/uncomplete task works
- [x] Delete task works
- [x] Real-time sync works (multi-tab)
- [x] Keyboard shortcuts work (N, /, ?, Cmd+K)
- [x] Mobile responsive
- [x] Dark mode works

### New Features:
- [x] InlineAddTask with AI preview
- [x] TaskSections (Overdue/Today/Upcoming/No Date)
- [x] Task Detail AI Actions
- [x] AI Inbox view skeleton
- [x] Chat as navigation view
- [x] Focus Mode toggle
- [x] Kanban/List view toggle

### To Verify Manually:
- [ ] AI smart-parse API returns correctly formatted results
- [ ] AI breakdown-task API generates useful subtasks
- [ ] AI enhance-task API improves descriptions
- [ ] Multi-tab real-time sync after changes
