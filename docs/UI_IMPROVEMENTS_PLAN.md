# UI Improvements Plan

> **Date**: 2026-01-20
> **Status**: Planning Complete → Ready for Implementation
> **Priority**: High

---

## Overview

This document outlines four UI improvements to enhance user experience:

1. **Floating Chat Icon** - Always visible chat access (bottom-right corner)
2. **Add Task Modal** - Popup modal for task creation instead of inline form
3. **Expanded Search** - Always-visible search with text field (not collapsed icon)
4. **Activity Monitor UX** - Full-page or improved view option

---

## 1. Floating Chat Icon (Bottom-Right Corner)

### Current State
- Chat is accessible via navigation sidebar
- Navigates to a full Chat view (`case 'chat'` in MainApp)
- Not always visible; requires navigation

### Proposed Changes
- Add a **floating action button (FAB)** in the bottom-right corner
- Always visible on all views (except when chat is already open)
- Shows unread message count badge
- Click opens a **chat drawer/panel** that slides in from the right
- Does NOT navigate away from current view

### Implementation Details

**New Component**: `src/components/FloatingChatButton.tsx`

```tsx
// Floating button with unread badge
// Position: fixed bottom-6 right-6
// Z-index: 40 (below modals at 50)
// On click: Opens ChatPanel as overlay/drawer
```

**Files to Modify**:
- `src/components/layout/AppShell.tsx` - Add FloatingChatButton
- `src/components/ChatPanel.tsx` - Add `docked` prop support for drawer mode
- `src/components/MainApp.tsx` - Remove chat from main view routing (optional)

**Visual Design**:
```
┌─────────────────────────────────────────────┐
│                                             │
│              Main Content Area              │
│                                             │
│                                             │
│                                             │
│                                    ┌───┐    │
│                                    │💬│ ← FAB with badge
│                                    │ 3│    │
│                                    └───┘    │
└─────────────────────────────────────────────┘
```

---

## 2. Add Task Modal Popup

### Current State
- AddTodo is rendered inline at the top of TodoList
- Takes up vertical space always
- Can feel cramped on mobile

### Proposed Changes
- Keep a compact "Add Task" button in the header/toolbar
- Clicking opens a **modal dialog** with the full AddTodo form
- Modal provides more space for subtasks, AI features
- Mobile-friendly with full-screen option

### Implementation Details

**New Component**: `src/components/AddTaskModal.tsx`

```tsx
// Modal wrapper around AddTodo component
// Props: isOpen, onClose, onAdd, users, darkMode, currentUserId
// Uses AnimatePresence for smooth open/close
// Includes backdrop blur
```

**Files to Modify**:
- `src/components/TodoList.tsx` - Replace inline AddTodo with button + modal
- `src/components/AddTodo.tsx` - Add `modal` prop for modal-specific styling

**Visual Design**:
```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────┐        │
│  │        Add New Task             │        │
│  │  ┌─────────────────────────┐   │        │
│  │  │ Task description...     │   │        │
│  │  └─────────────────────────┘   │        │
│  │  Priority: [Med ▼]  Due: [📅] │        │
│  │  Assign: [Derrick ▼]          │        │
│  │  ┌─────────────────────────┐   │        │
│  │  │ + Add subtask           │   │        │
│  │  └─────────────────────────┘   │        │
│  │  [🎤 Voice] [✨ AI Parse]     │        │
│  │                                 │        │
│  │  [Cancel]           [Add Task] │        │
│  └─────────────────────────────────┘        │
└─────────────────────────────────────────────┘
```

---

## 3. Expanded Search Field

### Current State
- Search is collapsed to an icon by default
- Expands on click to show input field
- State: `showSearchExpanded` controls expansion

### Proposed Changes
- Search field is **always expanded** showing icon + text input
- Consistent width (not dynamic)
- Placeholder text: "Search tasks..."
- Clear button when text is present

### Implementation Details

**Files to Modify**:
- `src/components/TodoList.tsx` - Remove `showSearchExpanded` toggle logic
- Simplify to always-visible search input

**Current Code** (lines ~1720-1770):
```tsx
// Current: AnimatePresence with conditional rendering
// Remove: showSearchExpanded state and toggle
// Keep: Just the expanded input version
```

**Visual Design**:
```
Before: [🔍]  →  click  →  [🔍 Search...____]

After:  [🔍 Search tasks...____________]  (always visible)
```

---

## 4. Activity Monitor UX Improvements

### Current State
- ActivityFeed renders as a **slide-over panel** from the right
- Max width: `max-w-md` (~448px)
- Overlay with backdrop blur
- Feels cramped for viewing activity history

### Proposed Changes

**Option A: Full-Page View** (Recommended)
- Activity becomes its own full-page view like Dashboard/Chat
- Already partially supported (`case 'activity'` in MainApp)
- Richer layout with filtering, date grouping, search

**Option B: Wider Panel with View Toggle**
- Keep slide-over but allow expansion to wider/full-width
- Add toggle button for "Expand" / "Minimize"
- Better for quick glances without leaving context

### Implementation Details

**Option A - Full Page** (selected):

**Files to Modify**:
- `src/components/ActivityFeed.tsx` - Add `fullPage` prop for layout mode
- `src/components/MainApp.tsx` - Render ActivityFeed directly for `case 'activity'`
- `src/components/TodoList.tsx` - Remove slide-over rendering, use navigation

**New Features for Full Page Mode**:
- Date grouping (Today, Yesterday, This Week, Older)
- Filter by action type dropdown
- Filter by user dropdown
- Search within activity
- Infinite scroll with "Load More"

**Visual Design (Full Page)**:
```
┌─────────────────────────────────────────────────────────────┐
│  Activity Feed                              [Filter ▼] [🔍] │
├─────────────────────────────────────────────────────────────┤
│  TODAY                                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🟢 Derrick completed "Call John about policy"    2:34pm ││
│  │ 📝 Sefra updated priority on "Review claim"      1:15pm ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  YESTERDAY                                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Derrick marked 5 tasks complete              4:45pm  ││
│  │ ➕ Sefra created "New client onboarding"        11:30am ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│                    [Load More Activity]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

| Order | Feature | Effort | Dependencies |
|-------|---------|--------|--------------|
| 1 | Expanded Search | Low | None |
| 2 | Add Task Modal | Medium | None |
| 3 | Floating Chat Icon | Medium | ChatPanel docked mode |
| 4 | Activity Monitor Full Page | Medium | Navigation already exists |

---

## Agent Assignment

| Task | Agent | Files |
|------|-------|-------|
| Expanded Search | Frontend Engineer | `TodoList.tsx` |
| Add Task Modal | Frontend Engineer | `AddTaskModal.tsx`, `TodoList.tsx` |
| Floating Chat Icon | Frontend Engineer | `FloatingChatButton.tsx`, `AppShell.tsx`, `ChatPanel.tsx` |
| Activity Full Page | Frontend Engineer + UX Review | `ActivityFeed.tsx`, `MainApp.tsx` |
| Code Review | Code Reviewer | All changes |
| Testing | QA/Frontend Engineer | E2E tests |

---

## Testing Checklist

### Expanded Search
- [ ] Search field visible on page load
- [ ] Typing filters tasks in real-time
- [ ] Clear button works
- [ ] Mobile responsive
- [ ] Dark mode styling

### Add Task Modal
- [ ] Button opens modal
- [ ] All AddTodo features work in modal
- [ ] Escape key closes modal
- [ ] Click outside closes modal
- [ ] Form resets on close
- [ ] Mobile full-screen mode
- [ ] Dark mode styling

### Floating Chat Icon
- [ ] Button visible on all views except chat
- [ ] Unread badge shows correct count
- [ ] Click opens chat drawer
- [ ] Chat drawer slides in smoothly
- [ ] Can send/receive messages in drawer
- [ ] Click outside closes drawer
- [ ] Mobile responsive
- [ ] Dark mode styling

### Activity Monitor
- [ ] Navigation opens full-page view
- [ ] Date grouping displays correctly
- [ ] Filters work (action type, user)
- [ ] Search filters results
- [ ] Load more pagination works
- [ ] Back navigation returns to tasks
- [ ] Mobile responsive
- [ ] Dark mode styling

---

## Definition of Done

- [ ] All four features implemented
- [ ] Code review passed
- [ ] No TypeScript errors (`npm run build`)
- [ ] No lint errors (`npm run lint`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Manual testing on desktop and mobile
- [ ] Dark mode verified
- [ ] Documentation updated (if needed)

---

**Last Updated**: 2026-01-20
**Author**: Tech Lead Agent
