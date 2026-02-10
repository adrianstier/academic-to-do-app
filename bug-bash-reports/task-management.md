# Bug Bash Report: Core Task Management

**Scope:** Core Task Management
**Auditor:** Claude (Scope Agent)
**Date:** 2026-02-09
**Files Reviewed:** 23 files across components, hooks, and store

## Files Audited

- `src/components/TodoList.tsx` (2827 lines)
- `src/components/TodoItem.tsx` (983 lines)
- `src/components/AddTodo.tsx` (927 lines)
- `src/components/AddTaskModal.tsx` (155 lines)
- `src/components/KanbanBoard.tsx` (930 lines)
- `src/components/SortableTodoItem.tsx` (78 lines)
- `src/components/SwipeableTodoItem.tsx` (426 lines)
- `src/components/SwipeableSortableTodoItem.tsx` (101 lines)
- `src/components/SmartParseModal.tsx` (360 lines)
- `src/components/DuplicateDetectionModal.tsx` (264 lines)
- `src/components/TemplatePicker.tsx` (502 lines)
- `src/components/FileImporter.tsx` (1058 lines)
- `src/components/ContentToSubtasksImporter.tsx` (780 lines)
- `src/components/InlineAddTask.tsx` (432 lines)
- `src/components/todo/TodoModals.tsx` (315 lines)
- `src/components/todo/BulkActionBar.tsx` (231 lines)
- `src/components/todo/TodoHeader.tsx` (326 lines)
- `src/components/todo/TodoStatsCards.tsx` (74 lines)
- `src/hooks/useTodoModals.ts` (713 lines)
- `src/hooks/useTodoData.ts` (401 lines)
- `src/hooks/useFilters.ts` (347 lines)
- `src/hooks/useBulkActions.ts` (369 lines)
- `src/store/todoStore.ts` (648 lines)

---

## Critical

### BUG-TM-1: AddTaskModal silently drops notes and recurrence data

**File:** `src/components/AddTaskModal.tsx` lines 12-21, 56-71
**Type:** Data loss
**Description:** `AddTaskModal.handleAdd` accepts only 8 parameters and forwards exactly 8 to its `onAdd` prop. However, the inner `AddTodo` component calls `onAdd` with 10 parameters (the 9th is `notes`, the 10th is `recurrence`). Since `handleAdd` only destructures and forwards the first 8 positional arguments, the `notes` and `recurrence` values are silently discarded.

This means that when a user fills in notes or sets a recurrence pattern through the Add Task modal, those fields are lost and never reach the database.

**Evidence:**

`AddTodo.tsx` line 23 defines `onAdd` with 10 params:
```typescript
onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string,
  subtasks?: Subtask[], transcription?: string, sourceFile?: File, reminderAt?: string,
  notes?: string, recurrence?: 'daily' | 'weekly' | 'monthly' | null) => void;
```

`AddTodo.tsx` line 312 calls with 10 args:
```typescript
onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined,
  subtasks, undefined, undefined, reminderAt || undefined, notes || undefined, recurrence || null);
```

`AddTaskModal.tsx` lines 56-67 only forwards 8:
```typescript
const handleAdd = useCallback(
  (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string,
    subtasks?: Subtask[], transcription?: string, sourceFile?: File, reminderAt?: string) => {
    onAdd(text, priority, dueDate, assignedTo, subtasks, transcription, sourceFile, reminderAt);
    onClose();
  }, [onAdd, onClose]
);
```

**The same 8-param signature is also present in `TodoModals.tsx` lines 89-98**, meaning the data loss also occurs when `AddTaskModal` is rendered through `TodoModals`.

**Reproduction:** Open the Add Task modal, enter a task with notes or recurrence, submit. Check the database -- notes and recurrence will be null.

**Fix:** Update `AddTaskModal.handleAdd` and its `onAdd` prop type to accept and forward all 10 parameters. Also update `TodoModals.tsx` `onAddTodo` prop type (lines 89-98) to match.

---

## High

### BUG-TM-2: KanbanBoard TaskDetailModal shows stale todo data after updates

**File:** `src/components/KanbanBoard.tsx` line 548
**Type:** State sync
**Description:** `KanbanBoard` stores the clicked todo in local React state (`selectedTodo`) as a snapshot. When the user edits the task in the `TaskDetailModal` (e.g., changes priority, status, due date, notes), the callbacks update the Zustand store and Supabase, but `selectedTodo` retains the stale snapshot. The modal continues displaying the old data until closed and reopened.

```typescript
const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
```

When a card is clicked, `setSelectedTodo(todo)` captures that moment's data. Subsequent store updates from `onSetPriority`, `onStatusChange`, etc. do NOT update this local state.

**Impact:** Users see outdated field values in the open task detail panel. If they make further edits based on stale data, they may inadvertently overwrite concurrent changes.

**Fix:** Instead of storing the full `Todo` object, store only the `selectedTodoId` and derive the current todo from the `todos` prop: `const selectedTodo = selectedTodoId ? todos.find(t => t.id === selectedTodoId) : null;`

---

### BUG-TM-3: Store selector `selectFilteredTodos` has no fallback for undefined priority

**File:** `src/store/todoStore.ts` line 565
**Type:** Runtime error / Sort corruption
**Description:** The `selectFilteredTodos` function uses `priorityOrder[a.priority]` without a fallback default. While the TypeScript type declares `priority: TodoPriority` as required, data fetched from Supabase may have `null` priority values if the database column permits it (and empirically, ~30 locations across the codebase defensively use `todo.priority || 'medium'`).

If `a.priority` is `undefined`, `priorityOrder[undefined]` returns `undefined`, causing `undefined - undefined` which yields `NaN`, breaking the sort comparator contract. This corrupts the sort order for all items in the list.

```typescript
// Store (no fallback):
filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

// useFilters.ts (has fallback):
priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']
```

**Impact:** Tasks with null/undefined priority from the database can corrupt the entire sort order when sorting by priority or urgency.

**Fix:** Add `|| 'medium'` fallback in the store selector on lines 565, 592 to match the pattern used in `useFilters.ts`.

---

### BUG-TM-4: FileImporter initialFile useEffect has stale closure risk

**File:** `src/components/FileImporter.tsx` lines 131-136
**Type:** Stale closure
**Description:** The `useEffect` for handling `initialFile` calls `handleFileSelect(initialFile)` but `handleFileSelect` is not included in the dependency array. The `eslint-disable` comment suppresses the warning. While the `initialFileProcessed.current` ref guard prevents repeated execution, the closure captures the version of `handleFileSelect` that existed at mount time.

If `handleFileSelect` depends on state that changes between mount and when the effect runs (e.g., if `onCreateTask` or other props change before the initial file is processed), the stale reference could use outdated callbacks.

```typescript
useEffect(() => {
  if (initialFile && !initialFileProcessed.current) {
    initialFileProcessed.current = true;
    handleFileSelect(initialFile); // Stale closure of handleFileSelect
  }
}, [initialFile]); // Missing handleFileSelect dependency
```

**Mitigating factor:** The `initialFileProcessed.current` ref means this effect only fires once, reducing the window for stale closure issues. However, if the parent re-mounts with a new `initialFile` prop after already processing one, the ref prevents processing.

**Fix:** Either wrap `handleFileSelect` in `useCallback` and add it to the dependency array, or use a ref to always hold the latest version of the function.

---

## Medium

### BUG-TM-5: FileImporter leaks ObjectURL for audio files on unmount

**File:** `src/components/FileImporter.tsx`
**Type:** Memory leak
**Description:** When processing audio files, `FileImporter` creates an ObjectURL via `URL.createObjectURL()` and stores it in the `audioUrl` state. The `handleClear` function properly revokes this URL, but there is no cleanup on component unmount. If the user navigates away or the component unmounts without clicking "Clear", the ObjectURL leaks.

**Impact:** Each leaked ObjectURL holds a reference to the file blob in memory. Over a session with many file imports, this can accumulate and degrade browser performance.

**Fix:** Add an effect cleanup that revokes `audioUrl` on unmount:
```typescript
useEffect(() => {
  return () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  };
}, [audioUrl]);
```

---

### BUG-TM-6: BulkActionBar dropdowns lack click-outside-to-close and mutual exclusion

**File:** `src/components/todo/BulkActionBar.tsx`
**Type:** UX bug
**Description:** The Bulk Action Bar in `BulkActionBar.tsx` (used in some views) uses custom dropdown buttons for assign, reschedule, and priority changes. These dropdowns:

1. Can be open simultaneously -- clicking one dropdown does not close others.
2. Have no click-outside-to-close behavior. The only way to dismiss them is to click the same toggle button again.

Note: In `TodoList.tsx` (lines 2715-2806), the bulk action bar is rendered inline with native `<select>` elements instead of custom dropdowns, which avoids these issues for the main task list view. The bug is specific to `BulkActionBar.tsx` when used in other contexts.

**Impact:** Multiple overlapping dropdowns create visual clutter and confuse users about which action they are about to take.

**Fix:** Add mutual exclusion state and a backdrop/click-outside handler similar to the "More" dropdown pattern already used in TodoList.tsx.

---

### BUG-TM-7: Recurring task creation does not preserve subtasks from completed task

**File:** `src/components/TodoList.tsx` lines 901-962 (`createNextRecurrence`)
**Type:** Data loss
**Description:** When a recurring task is completed, `createNextRecurrence` creates the next instance by spreading the completed todo, but the `insertData` object built for Supabase insertion does not include `subtasks`:

```typescript
const insertData: Record<string, unknown> = {
  id: newTodo.id,
  text: newTodo.text,
  completed: false,
  status: 'todo',
  created_at: newTodo.created_at,
  created_by: newTodo.created_by,
  due_date: newTodo.due_date,
  recurrence: newTodo.recurrence,
};
// Only adds priority, assigned_to, notes -- no subtasks
```

The optimistic `newTodo` object includes subtasks (via spread), so the UI temporarily shows them. But the database insert omits them, so after a page refresh the subtasks are gone.

**Impact:** Users who rely on recurring tasks with subtask checklists (e.g., weekly review items) lose their subtask structure every recurrence.

**Fix:** Add `if (newTodo.subtasks && newTodo.subtasks.length > 0) insertData.subtasks = newTodo.subtasks;` to the insertData construction, similar to how `createTodoDirectly` handles it (line 546).

---

### BUG-TM-8: Recurring task creation inherits completed subtask states

**File:** `src/components/TodoList.tsx` lines 919-926 (`createNextRecurrence`)
**Type:** Logic error
**Description:** Related to BUG-TM-7 -- even if the subtasks were properly persisted, the spread `{...completedTodo}` copies subtasks with their `completed: true` states from the finished task. The next recurrence should start with all subtasks reset to `completed: false`.

```typescript
const newTodo: Todo = {
  ...completedTodo,  // Copies subtasks with completed=true
  id: uuidv4(),
  completed: false,
  status: 'todo',
  due_date: nextDue.toISOString().split('T')[0],
  created_at: new Date().toISOString(),
};
// subtasks are NOT reset to uncompleted
```

**Impact:** Recurring tasks would appear to already have all subtasks completed when they recur.

**Fix:** Reset subtask completion states when creating the next recurrence:
```typescript
subtasks: completedTodo.subtasks?.map(st => ({ ...st, completed: false })),
```

---

### BUG-TM-9: Duplicate todo copies attachments by reference but does not duplicate files in storage

**File:** `src/components/TodoList.tsx` lines 767-819 (`duplicateTodo`)
**Type:** Data integrity
**Description:** The `duplicateTodo` function spreads the original todo to create a copy. If the original has `attachments`, the copy references the same storage paths. There is no file duplication in Supabase storage. This creates two issues:

1. If the original task's attachments are deleted (via the API which removes the storage file), the duplicate's attachment links become broken.
2. The insertData conditionally adds some fields but does NOT include `attachments`, so the database record for the duplicate has no attachments, but the optimistic UI shows them (via the spread).

```typescript
const newTodo: Todo = {
  ...todo,  // Includes todo.attachments in the optimistic object
  id: uuidv4(),
  // ...
};
// insertData does NOT include attachments
```

**Impact:** Duplicated tasks appear to have attachments in the UI but lose them on refresh. If a user deletes the original, the duplicate's attachment links could break.

**Fix:** Either explicitly copy attachments into `insertData` (and document the shared-reference behavior), or omit attachments from the spread and inform the user that attachments are not duplicated.

---

## Low

### BUG-TM-10: InlineAddTask AI preview does not allow subtask editing before creation

**File:** `src/components/InlineAddTask.tsx` line 156-181
**Type:** UX limitation
**Description:** When AI parsing produces subtasks in `InlineAddTask`, the preview card shows them in a read-only list. The `handleCreate` function creates subtasks directly from `parsedResult.subtasks` without any user editing capability. By contrast, `SmartParseModal` (used in `AddTodo`) provides full subtask editing (toggle, text edit, reorder).

This is a UX inconsistency rather than a crash bug, but users may be confused that they can edit AI-parsed subtasks in one flow but not the other.

**Impact:** Minor -- users can still edit subtasks after task creation by expanding the task.

---

### BUG-TM-11: Keyboard shortcut 'n' conflicts with typing in non-input elements

**File:** `src/components/TodoList.tsx` lines 394-398
**Type:** UX bug
**Description:** The keyboard shortcut handler checks for `HTMLInputElement`, `HTMLTextAreaElement`, and `HTMLSelectElement` targets to avoid triggering shortcuts while typing. However, it does not check for `contenteditable` elements or elements with `role="textbox"`. If any such elements exist in the page (e.g., rich text editors, custom input components), pressing 'n' while focused in them would steal focus to the add task input instead of typing 'n'.

```typescript
if (e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement) {
  return;
}
```

**Impact:** Low probability unless contenteditable elements are added. The current codebase appears to use standard form elements.

---

### BUG-TM-12: TemplatePicker delete does not verify API response before updating UI

**File:** `src/components/TemplatePicker.tsx`
**Type:** Optimistic update without rollback
**Description:** When deleting a template, the component calls `fetchWithCsrf` to delete via the API. The code checks `response.ok` to show a success toast, but the local state (`setTemplates`) is updated optimistically before the API call resolves. If the API call fails, the template disappears from the UI without any rollback.

**Impact:** Low -- templates are not critical data, and the user can refresh to restore the list. But it breaks the pattern of rollback-on-failure used consistently elsewhere in the codebase.

---

### BUG-TM-13: Merge modal does not have focus trap for accessibility

**File:** `src/components/TodoList.tsx` lines 2502-2645
**Type:** Accessibility
**Description:** The merge tasks modal is rendered inline in `TodoList.tsx` as raw divs with `role="dialog"` and `aria-modal="true"`, but it does not implement a focus trap. Keyboard users can Tab out of the modal into the content behind the backdrop. This violates WCAG 2.1 AA Success Criterion 2.4.3 (Focus Order).

By contrast, `DuplicateDetectionModal`, `SmartParseModal`, and other modals properly use the `useFocusTrap` hook.

**Impact:** Keyboard-only and screen reader users may lose context when the merge modal is open.

**Fix:** Extract the merge modal into its own component and apply the `useFocusTrap` hook, or add focus trap behavior inline.

---

### BUG-TM-14: Activity feed and archive modals rendered as full-page overlays lack focus traps

**File:** `src/components/TodoList.tsx` lines 2328-2365 (Activity Feed), 2376-2480 (Archive)
**Type:** Accessibility
**Description:** Similar to BUG-TM-13, the Activity Feed overlay (lines 2328-2365) and Archive modal (lines 2376-2480) declare `role="dialog"` and `aria-modal="true"` but do not implement focus trapping. Tab navigation can escape these overlays.

**Fix:** Add `useFocusTrap` to both overlay containers.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| Critical | 1 | Data loss (notes/recurrence dropped in modal flow) |
| High | 4 | Stale state in Kanban detail, sort corruption, stale closure |
| Medium | 5 | Memory leak, UX bugs, recurring task data loss |
| Low | 5 | Accessibility gaps, minor UX inconsistencies |
| **Total** | **15** | |

### Top Priority Fixes

1. **BUG-TM-1** (Critical): Fix AddTaskModal parameter forwarding -- users are actively losing data.
2. **BUG-TM-7 + BUG-TM-8** (Medium): Fix recurring task subtask handling -- subtasks are lost and states are not reset.
3. **BUG-TM-2** (High): Fix KanbanBoard stale selectedTodo -- users see wrong data in task detail.
4. **BUG-TM-3** (High): Add priority fallback in store selector -- prevents sort corruption.
5. **BUG-TM-9** (Medium): Fix duplicate task attachment handling -- attachments lost on refresh.
