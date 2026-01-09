# Task List View Design Specification

**Version:** 1.1
**Date:** 2026-01-09
**Status:** ✅ IMPLEMENTED

---

## Executive Summary

This specification addresses 6 critical UX issues in the task list view:
1. No visual hierarchy for overdue severity
2. Task titles too long, making cards too tall
3. Cramped metadata spacing
4. Redundant/confusing filter tabs
5. Status cards disconnected from filtered view
6. Missing hover actions and bulk selection UX

---

## Issue 1: Card Visual Hierarchy

### Current State (BEFORE)

```
┌─────────────────────────────────────────────────────────────┐
│ ⬛ All overdue tasks have identical dark red background     │
│    bg-[var(--danger-light)] + border-[var(--danger)]/30    │
│    regardless of priority level                             │
└─────────────────────────────────────────────────────────────┘
```

**Problem:** Every overdue task gets the same alarming red treatment. When 24 tasks are overdue, the entire list becomes a wall of red, eliminating visual hierarchy.

**Current code (TodoItem.tsx:300-306):**
```tsx
todo.completed
  ? 'bg-[var(--surface)] border-[var(--border-subtle)] opacity-60'
  : dueDateStatus === 'overdue'
    ? 'border-[var(--danger)]/30 bg-[var(--danger-light)]'  // ALL overdue = red
    : selected
      ? 'border-[var(--accent)] bg-[var(--accent-light)]'
      : 'bg-[var(--surface)] border-[var(--border)]...'
```

### Proposed State (AFTER)

```
┌─────────────────────────────────────────────────────────────┐
│ CRITICAL OVERDUE (urgent/high + overdue)                    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ Full red background: bg-red-500/15 dark:bg-red-500/20      │
│ Red border: border-red-500/40                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MODERATE OVERDUE (medium + overdue)                         │
│ ┃ Red left border only (3px): border-l-[3px] border-l-red-500│
│ ┃ Normal background: bg-[var(--surface)]                    │
│ ┃ Subtle urgency without alarm                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LOW PRIORITY OVERDUE (low + overdue)                        │
│ Normal dark gray background: bg-[var(--surface)]            │
│ Only the date badge shows red "Overdue"                     │
│ Doesn't demand attention                                    │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

**New helper function:**
```tsx
const getCardStyle = (todo: Todo, dueDateStatus: string | null, selected: boolean) => {
  // Completed tasks
  if (todo.completed) {
    return 'bg-[var(--surface)] border-[var(--border-subtle)] opacity-60';
  }

  // Selected state
  if (selected) {
    return 'border-[var(--accent)] bg-[var(--accent-light)]';
  }

  // Overdue severity hierarchy
  if (dueDateStatus === 'overdue') {
    const isHighPriority = todo.priority === 'urgent' || todo.priority === 'high';
    const isMediumPriority = todo.priority === 'medium';

    if (isHighPriority) {
      // CRITICAL: Full red background
      return 'bg-red-500/15 dark:bg-red-500/20 border-red-500/40';
    } else if (isMediumPriority) {
      // MODERATE: Red left accent only
      return 'bg-[var(--surface)] border-[var(--border)] border-l-[3px] border-l-red-500';
    }
    // LOW: Normal card, date badge shows urgency
  }

  // Default card
  return 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-md)]';
};
```

---

## Issue 2: Task Title Truncation

### Current State (BEFORE)

```
┌─────────────────────────────────────────────────────────────┐
│ ☐ Follow up with John Smith regarding his auto policy       │
│   renewal quote that was sent last week and confirm         │
│   whether he received the updated coverage options          │
│   documentation via email on Tuesday                        │
│   ─────────────────────────────────────────────────────────│
│   [High] [Jan 15] [Derrick] [3 subtasks]                   │
└─────────────────────────────────────────────────────────────┘
Height: ~120px (3-4 lines of text)
```

### Proposed State (AFTER)

```
┌─────────────────────────────────────────────────────────────┐
│ ☐ Follow up with John Smith regarding his auto policy       │
│   renewal quote that was sent last week and confirm...      │
│   ─────────────────────────────────────────────────────────│
│   [High] [Jan 15] [Derrick] [3 subtasks]                   │
└─────────────────────────────────────────────────────────────┘
Height: ~72px (2 lines max)

Hover tooltip shows full text
```

### Implementation

**CSS class for text truncation:**
```css
.task-title-truncate {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**Component update:**
```tsx
<p
  className={`font-medium task-title-truncate ${
    todo.completed ? 'text-[var(--text-light)] line-through' : 'text-[var(--foreground)]'
  }`}
  title={todo.text}  // Full text on hover
>
  {todo.text}
</p>
```

---

## Issue 3: Metadata Spacing

### Current State (BEFORE)

```
[High][Jan15][Derrick][3tasks][Note]  ← ~4px gaps, cramped
```

**Current code (TodoItem.tsx:363):**
```tsx
<div className="flex items-center gap-2 mt-1.5 flex-wrap">
```

### Proposed State (AFTER)

```
[High]  [Jan 15]  │  [Derrick]  [3 tasks]  [Note]
   └──── 8px ────┘    └──── 8px between related badges ────┘
```

### Implementation

**Updated spacing:**
```tsx
<div className="flex items-center gap-2 mt-2 flex-wrap">
  {/* Priority + Date group */}
  <div className="flex items-center gap-2">
    <span className="priority-badge">...</span>
    <span className="date-badge">...</span>
  </div>

  {/* Visual separator */}
  <div className="w-px h-4 bg-[var(--border)] mx-1" />

  {/* Assignment + Metadata group */}
  <div className="flex items-center gap-2">
    {todo.assigned_to && <span className="assignee-badge">...</span>}
    {subtasks.length > 0 && <span className="subtask-badge">...</span>}
    {todo.notes && <span className="note-badge">...</span>}
  </div>
</div>
```

**Card padding update:**
```tsx
// Current: p-4 (16px all around)
// New: px-4 py-3 (16px horizontal, 12px vertical)
<div className="flex items-center gap-3 px-4 py-3">
```

---

## Issue 4: Filter Consolidation

### Current State (BEFORE)

```
Filter tabs (5 separate):
[All] [My Tasks] [Urgent] [Triage (24)] | [Done (5)]

Problems:
- "All" is redundant (default state)
- "Urgent" duplicates priority badge filtering
- "Triage" is confusing terminology
- "Done" should be a toggle, not a filter
```

### Proposed State (AFTER)

```
┌─────────────────────────────────────────────────────────────┐
│ [My Tasks ▾]  [High Priority]  [Show Completed]  [Filters ▾]│
└─────────────────────────────────────────────────────────────┘

My Tasks dropdown:
  ○ All Tasks
  ● My Tasks (assigned to me)
  ○ Created by Me
  ○ Unassigned

Filters dropdown (advanced):
  Priority: [ ] Low  [ ] Medium  [✓] High  [✓] Urgent
  Status:   [✓] To Do  [✓] In Progress  [ ] Done
  Has: [ ] Attachments  [ ] Notes  [ ] Subtasks
  Date Range: [From] → [To]
```

### Implementation

**New QuickFilter type:**
```tsx
// Before
export type QuickFilter = 'all' | 'my_tasks' | 'due_today' | 'overdue' | 'urgent' | 'triage';

// After
export type QuickFilter = 'all' | 'my_tasks' | 'created_by_me' | 'unassigned';
export type PriorityFilter = 'all' | 'high_priority';  // high + urgent only
```

**Simplified filter bar:**
```tsx
<div className="flex items-center gap-3">
  {/* Assignment filter dropdown */}
  <select
    value={quickFilter}
    onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}
    className="filter-select"
  >
    <option value="all">All Tasks</option>
    <option value="my_tasks">My Tasks</option>
    <option value="created_by_me">Created by Me</option>
    <option value="unassigned">Unassigned</option>
  </select>

  {/* High priority toggle */}
  <button
    onClick={() => setPriorityFilter(p => p === 'all' ? 'high_priority' : 'all')}
    className={`filter-chip ${priorityFilter === 'high_priority' ? 'active' : ''}`}
  >
    <AlertTriangle className="w-3.5 h-3.5" />
    High Priority
  </button>

  {/* Show completed toggle */}
  <button
    onClick={() => setShowCompleted(!showCompleted)}
    className={`filter-chip ${showCompleted ? 'active' : ''}`}
  >
    <Check className="w-3.5 h-3.5" />
    Show Completed
  </button>

  {/* Advanced filters */}
  <button
    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
    className="filter-chip"
  >
    <Filter className="w-3.5 h-3.5" />
    Filters
    {hasActiveFilters && <span className="filter-count">{activeFilterCount}</span>}
  </button>
</div>
```

---

## Issue 5: Status Cards Dynamic Filtering

### Current State (BEFORE)

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 26       │ │ 0        │ │ 24       │
│ To Do    │ │ Due Today│ │ Overdue  │
└──────────┘ └──────────┘ └──────────┘
       ↓           ↓            ↓
    Click changes filter, but counts are GLOBAL
    not reflecting current filtered view
```

**Problem:** When filtered to "My Tasks", the cards still show total counts for all users.

### Proposed State (AFTER)

```
┌──────────────────────────────────────────────────────────────┐
│ Viewing: My Tasks                                            │
├──────────┬──────────┬──────────┬──────────────────────────────┤
│ 8        │ 0        │ 6        │ 2 completed today            │
│ To Do    │ Due Today│ Overdue  │ +12 from last week           │
└──────────┴──────────┴──────────┴──────────────────────────────┘
       ↓           ↓            ↓
    Counts update based on current filter context
    Active filter has ring highlight
```

### Implementation

**Dynamic stats calculation:**
```tsx
const stats = useMemo(() => {
  // Apply current filters to get base set
  let filtered = todos;

  // Apply assignment filter
  if (quickFilter === 'my_tasks') {
    filtered = filtered.filter(t => t.assigned_to === userName);
  } else if (quickFilter === 'created_by_me') {
    filtered = filtered.filter(t => t.created_by === userName);
  } else if (quickFilter === 'unassigned') {
    filtered = filtered.filter(t => !t.assigned_to);
  }

  // Apply priority filter
  if (priorityFilter === 'high_priority') {
    filtered = filtered.filter(t => t.priority === 'high' || t.priority === 'urgent');
  }

  // Calculate stats from filtered set
  const active = filtered.filter(t => !t.completed).length;
  const dueToday = filtered.filter(t => !t.completed && isDueToday(t.due_date)).length;
  const overdue = filtered.filter(t => !t.completed && isOverdue(t.due_date, t.completed)).length;

  return { active, dueToday, overdue };
}, [todos, quickFilter, priorityFilter, userName]);
```

**Add context label:**
```tsx
{quickFilter !== 'all' && (
  <div className="text-xs text-[var(--text-muted)] mb-2">
    Showing: {quickFilter === 'my_tasks' ? 'My Tasks' : 'All Tasks'}
  </div>
)}
```

---

## Issue 6: Hover Actions & Selection UX

### Current State (BEFORE)

```
┌─────────────────────────────────────────────────────────────┐
│ ☐ Task title here                                           │
│   [High] [Jan 15] [Derrick]                                │
│   ─────────────────────────────────────────────────────────│
│   [date picker] [assign dropdown] [priority dropdown]       │
│   ↑ Inline actions appear on hover, but cluttered          │
└─────────────────────────────────────────────────────────────┘

No visible "more actions" menu
No bulk selection feedback
```

### Proposed State (AFTER)

**A. Hover State - Three-dot menu:**
```
┌─────────────────────────────────────────────────────────────┐
│ ☐ Task title here                                      [⋮] │
│   [High] [Jan 15] [Derrick]                                │
└─────────────────────────────────────────────────────────────┘
                                                           ↓
                                               ┌──────────────┐
                                               │ Edit         │
                                               │ Duplicate    │
                                               │ Set Due Date │
                                               │ Assign       │
                                               │ ────────────│
                                               │ Save Template│
                                               │ Email Summary│
                                               │ ────────────│
                                               │ Delete       │
                                               └──────────────┘
```

**B. Bulk Selection Bar:**
```
┌─────────────────────────────────────────────────────────────┐
│ [✓] 3 selected  •  Mark Complete  •  Reassign  •  Change   │
│                     Date  •  Delete  •  [Cancel]           │
└─────────────────────────────────────────────────────────────┘
Sticky at bottom of screen when items selected
```

### Implementation

**A. Three-dot menu component:**
```tsx
const TaskActions = ({ todo, onAction }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100
                   hover:bg-[var(--surface-2)] transition-all"
      >
        <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48
                        bg-[var(--surface)] border border-[var(--border)]
                        rounded-lg shadow-lg py-1 z-50">
          <MenuItem icon={Pencil} label="Edit" onClick={() => onAction('edit')} />
          <MenuItem icon={Copy} label="Duplicate" onClick={() => onAction('duplicate')} />
          <MenuItem icon={Calendar} label="Set Due Date" onClick={() => onAction('due_date')} />
          <MenuItem icon={User} label="Assign" onClick={() => onAction('assign')} />
          <Divider />
          <MenuItem icon={FileText} label="Save as Template" onClick={() => onAction('template')} />
          <MenuItem icon={Mail} label="Email Summary" onClick={() => onAction('email')} />
          <Divider />
          <MenuItem icon={Trash2} label="Delete" onClick={() => onAction('delete')} danger />
        </div>
      )}
    </div>
  );
};
```

**B. Bulk selection bar:**
```tsx
{selectedTodos.size > 0 && (
  <div className="fixed bottom-0 left-0 right-0 z-50
                  bg-[var(--surface)] border-t border-[var(--border)]
                  shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
    <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
      {/* Selection count */}
      <div className="flex items-center gap-2">
        <button
          onClick={clearSelection}
          className="p-1 rounded hover:bg-[var(--surface-2)]"
        >
          <X className="w-4 h-4" />
        </button>
        <span className="font-medium">{selectedTodos.size} selected</span>
      </div>

      <div className="w-px h-6 bg-[var(--border)]" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <BulkActionButton
          icon={Check}
          label="Mark Complete"
          onClick={handleBulkComplete}
        />
        <BulkActionButton
          icon={User}
          label="Reassign"
          onClick={() => setShowReassignModal(true)}
        />
        <BulkActionButton
          icon={Calendar}
          label="Change Date"
          onClick={() => setShowDateModal(true)}
        />
        <BulkActionButton
          icon={Trash2}
          label="Delete"
          onClick={handleBulkDelete}
          danger
        />
      </div>
    </div>
  </div>
)}
```

---

## Visual Summary: Before vs After

### Card Styling Comparison

| State | Before | After |
|-------|--------|-------|
| High priority + overdue | Red bg (same as all overdue) | **Full red background** |
| Medium priority + overdue | Red bg (same) | **Red left border only** |
| Low priority + overdue | Red bg (same) | **Normal bg, red date badge** |
| Normal task | Gray bg | Gray bg (unchanged) |
| Completed | Faded gray | Faded gray (unchanged) |

### Filter Bar Comparison

| Before | After |
|--------|-------|
| [All] [My Tasks] [Urgent] [Triage] [Done] | [My Tasks ▾] [High Priority] [Show Completed] [Filters ▾] |
| 5 tabs, confusing | 4 controls, clear purpose |
| Triage unclear | Removed - use Overdue card click |
| Done as tab | Toggle button |

### Status Cards Comparison

| Before | After |
|--------|-------|
| Global counts always | **Filtered counts** based on current view |
| No context label | Shows "Viewing: My Tasks" when filtered |
| Static | **Dynamic** updates on filter change |

---

## Implementation Priority

### Phase 1: Critical Fixes (1-2 hours) ✅ COMPLETED
1. ✅ Card hierarchy based on priority + overdue — [TodoItem.tsx:314-338](src/components/TodoItem.tsx#L314-L338)
2. ✅ Title truncation to 2 lines — [TodoItem.tsx:389-398](src/components/TodoItem.tsx#L389-L398) using `line-clamp-2`
3. ✅ Metadata spacing fixes — [TodoItem.tsx:401-517](src/components/TodoItem.tsx#L401-L517) with visual separators

### Phase 2: Filter Consolidation (2-3 hours) ✅ COMPLETED
4. ✅ Simplify filter tabs — [TodoList.tsx:1872-1962](src/components/TodoList.tsx#L1872-L1962) with dropdown + toggles
5. ✅ Dynamic status card counts — [TodoList.tsx:1497-1518](src/components/TodoList.tsx#L1497-L1518) context-aware stats
6. ✅ Context labels — [TodoList.tsx:1759-1768](src/components/TodoList.tsx#L1759-L1768) showing current filter

### Phase 3: Interaction Polish (2-3 hours) ✅ COMPLETED
7. ✅ Three-dot hover menu — [TodoItem.tsx:570-668](src/components/TodoItem.tsx#L570-L668) with all actions
8. ✅ Improved bulk selection bar — [TodoList.tsx:2574-2665](src/components/TodoList.tsx#L2574-L2665)
9. ✅ Sticky action bar at bottom — Fixed positioning with all bulk actions

---

## Files to Modify

1. **src/components/TodoItem.tsx**
   - Card background logic
   - Title truncation CSS
   - Metadata spacing
   - Three-dot menu

2. **src/components/TodoList.tsx**
   - Filter bar simplification
   - Dynamic stats calculation
   - Bulk selection bar redesign

3. **src/types/todo.ts**
   - Update QuickFilter type
   - Add PriorityFilter type

4. **src/app/globals.css** (or Tailwind config)
   - `.task-title-truncate` class

---

## Acceptance Criteria

- [x] Only high-priority overdue tasks have full red background — **DONE** (bg-red-500/15)
- [x] Medium-priority overdue tasks have red left border only — **DONE** (border-l-[3px] border-l-red-500)
- [x] Low-priority overdue tasks have normal background — **DONE** (default card style)
- [x] Task titles truncate at 2 lines with "..." and show full text on hover — **DONE** (line-clamp-2 + title attr)
- [x] Metadata badges have 8px spacing between groups — **DONE** (gap-2 + visual separator)
- [x] Filter bar has max 4 controls: assignment dropdown, high-priority toggle, completed toggle, filters menu — **DONE**
- [x] Status card counts update when filters change — **DONE** (useMemo with filter context)
- [x] Three-dot menu appears on card hover (right side) — **DONE** (MoreVertical icon with dropdown)
- [x] Bulk selection shows sticky action bar at bottom — **DONE** (fixed bottom-0)
- [x] Action bar shows: count, Mark Complete, Reassign, Change Date, Delete — **DONE** (+ Merge for 2+ items)
