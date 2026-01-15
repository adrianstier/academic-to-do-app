# TaskAssignmentCard Technical Architecture

**Version:** 1.0
**Created:** 2026-01-15
**Author:** Tech Lead
**Status:** Ready for Implementation
**Risk Level:** Low
**Estimated Effort:** 4-6 hours

---

## Executive Summary

This document provides the technical architecture and implementation guidelines for the TaskAssignmentCard feature. The feature replaces text-based system notifications in chat with rich visual cards that match the app's design system, improving accessibility and scannability.

### Architectural Impact Assessment

| Category | Impact | Risk |
|----------|--------|------|
| Database | None | N/A |
| API | None | N/A |
| State Management | Minor (prop drilling) | Low |
| Component Structure | Medium (new component + integration) | Low |
| Testing | Medium (new test cases) | Low |
| Bundle Size | Minimal (+~5KB) | Low |
| ChatPanel Complexity | Medium (conditional rendering) | Low |

---

## 1. Architecture Overview

### 1.1 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ChatPanel.tsx                                   │
│                           (Message Rendering)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────────────────────┐  │
│  │   Message Loop       │    │          Conditional Renderer            │  │
│  │                      │    │                                          │  │
│  │  messages.map(msg => │───►│  isSystemNotification(msg) &&            │  │
│  │    renderMessage()   │    │  todosMap.get(msg.related_todo_id)       │  │
│  │  )                   │    │           ?                              │  │
│  └──────────────────────┘    │   ┌───────────────────────────────────┐  │  │
│                              │   │    TaskAssignmentCard              │  │  │
│                              │   │    (Rich visual card)              │  │  │
│                              │   └───────────────────────────────────┘  │  │
│                              │           :                              │  │
│                              │   ┌───────────────────────────────────┐  │  │
│                              │   │    Standard Message Bubble        │  │  │
│                              │   │    (Text + View Task button)      │  │  │
│                              │   └───────────────────────────────────┘  │  │
│                              └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Data Dependencies
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
                ▼                       ▼                       ▼
    ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
    │  ChatMessage      │   │  Todo (from prop) │   │  PRIORITY_CONFIG  │
    │  - created_by     │   │  - text           │   │  - color          │
    │  - related_todo_id│   │  - priority       │   │  - bgColor        │
    │  - text           │   │  - due_date       │   │  - label          │
    │  - recipient      │   │  - subtasks       │   └───────────────────┘
    └───────────────────┘   │  - notes          │
                            └───────────────────┘
```

### 1.2 Data Flow

```
System sends notification
         │
         ▼
┌─────────────────────────────────────┐
│  messages table                     │
│  - created_by: 'System'             │
│  - related_todo_id: 'uuid'          │
│  - text: '📋 **New Task Assigned**' │
│  - recipient: 'Sefra'               │
└─────────────────────────────────────┘
         │
         │ Real-time subscription
         ▼
┌─────────────────────────────────────┐
│  ChatPanel receives message         │
│                                     │
│  1. Check: isSystemNotification(msg)│
│  2. Lookup: todosMap.get(todo_id)   │
│  3. Parse: extractNotificationType()│
└─────────────────────────────────────┘
         │
         ▼
   ┌─────┴─────┐
   │           │
Has Todo   No Todo
   │           │
   ▼           ▼
┌─────────┐ ┌───────────────┐
│ Card    │ │ Fallback Text │
│ Render  │ │ Message       │
└─────────┘ └───────────────┘
```

### 1.3 Component Interaction Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         TodoList.tsx                             │
│                                                                 │
│   const todosMap = useMemo(                                     │
│     () => new Map(todos.map(t => [t.id, t])),                   │
│     [todos]                                                      │
│   );                                                             │
│                                                                 │
│   <ChatPanel                                                    │
│     todos={todos}          // Already passed                    │
│     todosMap={todosMap}    // NEW: Add for O(1) lookup          │
│     ...                                                         │
│   />                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ChatPanel.tsx                            │
│                                                                 │
│   interface ChatPanelProps {                                    │
│     todos?: Todo[];                   // Existing                │
│     todosMap?: Map<string, Todo>;     // NEW                     │
│   }                                                             │
│                                                                 │
│   // In message render:                                         │
│   const linkedTodo = todosMap?.get(msg.related_todo_id);        │
│                                                                 │
│   {isSystemNotification(msg) && linkedTodo ? (                  │
│     <TaskAssignmentCard ... />                                  │
│   ) : (                                                         │
│     <StandardMessageBubble ... />                               │
│   )}                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TaskAssignmentCard.tsx                        │
│                                                                 │
│   Props:                                                         │
│   - todo: Todo                                                   │
│   - notificationType: SystemNotificationType                     │
│   - actionBy: string                                             │
│   - onViewTask: () => void                                       │
│                                                                 │
│   Renders:                                                       │
│   - Priority color bar                                           │
│   - Header (icon, title, subtitle)                               │
│   - Task title + priority badge                                  │
│   - Due date with overdue warning                                │
│   - Subtask preview (max 3)                                      │
│   - Notes preview (line-clamp-2)                                 │
│   - View Task button                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. File Structure & Dependencies

### 2.1 Files to Create

```
src/components/chat/
├── TaskAssignmentCard.tsx   # NEW - Visual card component (~250 lines)
└── index.ts                 # NEW - Barrel export
```

### 2.2 Files to Modify

```
src/types/todo.ts            # Add SystemNotificationType, isSystemNotification()
src/components/ChatPanel.tsx # Import card, add todosMap usage, conditional render
```

### 2.3 Files Optionally Modified (Future Enhancement)

```
src/lib/taskNotifications.ts # Add structured metadata to messages
```

### 2.4 Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│               src/components/chat/TaskAssignmentCard.tsx         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  External Dependencies:                                         │
│  ├── react (memo, useCallback)                                  │
│  ├── framer-motion (motion)                                     │
│  ├── lucide-react (Calendar, CheckCircle, FileText, etc.)       │
│  └── date-fns (formatDistanceToNow, isPast, isToday, etc.)      │
│                                                                 │
│  Internal Dependencies:                                         │
│  ├── @/types/todo (Todo, PRIORITY_CONFIG, SystemNotificationType)│
│  └── None others (self-contained)                               │
│                                                                 │
│  Exports:                                                        │
│  └── TaskAssignmentCard (named + default)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ imports
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    src/components/ChatPanel.tsx                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  New Imports:                                                   │
│  ├── { TaskAssignmentCard } from './chat/TaskAssignmentCard'    │
│  └── { isSystemNotification, SystemNotificationType } from...   │
│                                                                 │
│  New Prop:                                                       │
│  └── todosMap?: Map<string, Todo>                                │
│                                                                 │
│  New Helper Functions:                                          │
│  ├── parseSystemMessage(msg) → NotificationMetadata | null       │
│  └── Inline: conditional card vs bubble rendering                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Type Definitions

### 3.1 New Types (src/types/todo.ts)

```typescript
// ============================================
// Chat Message Metadata Types
// ============================================

/**
 * Notification types for system-generated messages
 */
export type SystemNotificationType =
  | 'task_assignment'
  | 'task_completion'
  | 'task_reassignment';

/**
 * Metadata for system notification messages
 * Can be parsed from message text or stored separately
 */
export interface SystemMessageMetadata {
  type: SystemNotificationType;
  taskId: string;
  actionBy: string;
  previousAssignee?: string;
  renderAsCard: true;
}

/**
 * Type guard to check if a message is a system notification
 * that should potentially render as a card
 *
 * @param message - The chat message to check
 * @returns true if message is from System and has a linked task
 */
export function isSystemNotification(message: ChatMessage): boolean {
  return message.created_by === 'System' && !!message.related_todo_id;
}
```

### 3.2 Component Props Interface

```typescript
interface TaskAssignmentCardProps {
  /** The task being notified about */
  todo: Todo;
  /** Type of notification */
  notificationType: SystemNotificationType;
  /** Who triggered this notification */
  actionBy: string;
  /** Optional: who was previously assigned (for reassignment) */
  previousAssignee?: string;
  /** Callback when user wants to view the task */
  onViewTask: () => void;
  /** Whether the current user is the message sender (affects styling) */
  isOwnMessage?: boolean;
}
```

### 3.3 ChatPanel Props Update

```typescript
interface ChatPanelProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
  todos?: Todo[];                      // Existing
  todosMap?: Map<string, Todo>;        // NEW - for O(1) lookups
  onCreateTask?: (text: string, assignedTo?: string) => void;
  onTaskLinkClick?: (todoId: string) => void;
}
```

---

## 4. Component Architecture

### 4.1 TaskAssignmentCard Internal Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  <article role="button" tabIndex={0} onClick={onViewTask}>      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Priority Color Bar (height: 4px)                         │  │
│  │  backgroundColor: PRIORITY_CONFIG[priority].color          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Padding: 16px                                            │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Header                                              │  │  │
│  │  │  ┌──────┐  ┌───────────────────────────────────────┐ │  │  │
│  │  │  │ Icon │  │ Title: "New Task Assigned"           │ │  │  │
│  │  │  │ 28px │  │ Subtitle: "from Derrick"             │ │  │  │
│  │  │  └──────┘  └───────────────────────────────────────┘ │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Task Title + Priority Badge                        │  │  │
│  │  │  "Call John Smith"              [High]              │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Due Date (optional)                                │  │  │
│  │  │  📅 Due tomorrow                                    │  │  │
│  │  │  ⚠️ Overdue (Jan 10) [red styling]                  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Subtasks Preview (optional, max 3)                 │  │  │
│  │  │  ✓/○ 2/3 subtasks                                   │  │  │
│  │  │    ✓ Review coverage                                │  │  │
│  │  │    ○ Calculate premium                              │  │  │
│  │  │    ○ Send quote                                     │  │  │
│  │  │    +2 more...                                       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Notes Preview (optional, line-clamp-2)             │  │  │
│  │  │  📝 Customer mentioned they want to increase...     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Footer (border-top)                                │  │  │
│  │  │                            [View Task →]            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 State Management

**TaskAssignmentCard is stateless** - all data comes from props:

- `todo` - Live task data (reflects current state)
- `notificationType` - Parsed from message text
- `actionBy` - Parsed from message text
- `onViewTask` - Callback from parent

**No internal state required** - pure presentation component.

### 4.3 Event Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                    Event Flow Diagram                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Interaction         Handler             Action            │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Click on card     ─►  handleCardClick()  ─►  onViewTask()      │
│                                                                 │
│  Press Enter/Space ─►  handleKeyDown()    ─►  onViewTask()      │
│                                                                 │
│  Click "View Task" ─►  handleButtonClick()                      │
│                           │                                     │
│                           ├─► e.stopPropagation()               │
│                           └─► onViewTask()                      │
│                                                                 │
│  Note: stopPropagation on button prevents double-firing         │
│  when button is inside the clickable card                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. ChatPanel Integration

### 5.1 Message Rendering Flow

```typescript
// Current flow (simplified):
messages.map(msg => (
  <motion.div className="message-bubble">
    {renderMessageText(msg.text)}
    {msg.related_todo_id && <ViewTaskButton />}
  </motion.div>
))

// New flow with card detection:
messages.map(msg => {
  const systemMeta = parseSystemMessage(msg);
  const linkedTodo = msg.related_todo_id ? todosMap?.get(msg.related_todo_id) : undefined;

  if (systemMeta && linkedTodo) {
    // Render rich card
    return <TaskAssignmentCard
      todo={linkedTodo}
      notificationType={systemMeta.notificationType}
      actionBy={systemMeta.actionBy}
      onViewTask={() => onTaskLinkClick?.(msg.related_todo_id!)}
    />;
  }

  // Fallback to standard bubble
  return (
    <motion.div className="message-bubble">
      {renderMessageText(msg.text)}
      {msg.related_todo_id && !systemMeta && <ViewTaskButton />}
    </motion.div>
  );
})
```

### 5.2 parseSystemMessage Helper

```typescript
/**
 * Parse system message to extract notification type and metadata
 * Uses text pattern matching (no database changes required)
 */
const parseSystemMessage = useCallback((message: ChatMessage): {
  notificationType: SystemNotificationType;
  actionBy: string;
  previousAssignee?: string;
} | null => {
  if (!isSystemNotification(message)) return null;

  const text = message.text;

  // Pattern: "📋 **New Task Assigned**\nFrom: Username"
  if (text.includes('New Task Assigned') || text.includes('Task Reassigned to You')) {
    const fromMatch = text.match(/From:\s*(\w+)/);
    const byMatch = text.match(/By:\s*(\w+)/);
    const actionBy = fromMatch?.[1] || byMatch?.[1] || 'System';

    if (text.includes('Reassigned')) {
      return { notificationType: 'task_reassignment', actionBy };
    }
    return { notificationType: 'task_assignment', actionBy };
  }

  // Pattern: "✅ **Task Completed**\nBy: Username"
  if (text.includes('Task Completed')) {
    const byMatch = text.match(/By:\s*(\w+)/);
    return { notificationType: 'task_completion', actionBy: byMatch?.[1] || 'System' };
  }

  // Pattern: "📋 **Task Reassigned**\nFrom you to NewUser by Reassigner"
  if (text.includes('Task Reassigned') && !text.includes('to You')) {
    const byMatch = text.match(/by\s+(\w+)/);
    const toMatch = text.match(/to\s+(\w+)/);
    return {
      notificationType: 'task_reassignment',
      actionBy: byMatch?.[1] || 'System',
      previousAssignee: undefined,
    };
  }

  return null;
}, []);
```

### 5.3 Integration Location

**File:** `src/components/ChatPanel.tsx`
**Lines:** ~1580-1620 (message rendering section)

```tsx
// Before the motion.div message bubble, add conditional check:
{(() => {
  const systemMeta = parseSystemMessage(msg);
  const linkedTodo = msg.related_todo_id ? todosMap?.get(msg.related_todo_id) : undefined;

  if (systemMeta && linkedTodo) {
    return (
      <TaskAssignmentCard
        todo={linkedTodo}
        notificationType={systemMeta.notificationType}
        actionBy={systemMeta.actionBy}
        previousAssignee={systemMeta.previousAssignee}
        onViewTask={() => onTaskLinkClick?.(msg.related_todo_id!)}
        isOwnMessage={isOwn}
      />
    );
  }

  // Return existing message bubble JSX...
  return (
    <motion.div ...>
      {/* existing code */}
    </motion.div>
  );
})()}
```

---

## 6. Accessibility Requirements (WCAG 2.1 AA)

### 6.1 ARIA Attributes Matrix

| Element | Attributes | Purpose |
|---------|------------|---------|
| Card container | `role="button"`, `tabIndex={0}`, `aria-label` | Interactive element |
| Priority bar | `aria-hidden="true"` | Decorative |
| Icons | `aria-hidden="true"` | Decorative |
| Subtask checkmarks | `aria-hidden="true"` + `.sr-only` | Visual + screen reader text |
| View Task button | `aria-label="View task: {taskText}"` | Descriptive action |

### 6.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Focus card |
| Enter | Activate card (view task) |
| Space | Activate card (view task) |
| Tab (inside card) | Focus "View Task" button |

### 6.3 Screen Reader Experience

```
Announcement flow:
1. "New Task Assigned: Call John Smith. High priority. Click to view task." (card focus)
2. [Tab to button] "View task: Call John Smith, button"

No emoji announcements - all emojis replaced with visual elements and aria-hidden.
```

### 6.4 Focus Indicators

```css
/* Focus ring (Tailwind classes) */
focus:outline-none
focus:ring-2
focus:ring-blue-500
focus:ring-offset-2
dark:focus:ring-offset-gray-900
```

---

## 7. Visual Design Specifications

### 7.1 Card Dimensions

| Breakpoint | Width |
|------------|-------|
| Mobile (<640px) | `w-full` (100%) |
| Desktop (>=640px) | `max-w-xs` (320px) |

### 7.2 Color System

Uses existing `PRIORITY_CONFIG` from `src/types/todo.ts`:

| Priority | Color Bar | Badge BG | Badge Text |
|----------|-----------|----------|------------|
| urgent | `#ef4444` | `rgba(239, 68, 68, 0.1)` | `#ef4444` |
| high | `#f59e0b` | `rgba(245, 158, 11, 0.1)` | `#f59e0b` |
| medium | `#3b82f6` | `rgba(59, 130, 246, 0.1)` | `#3b82f6` |
| low | `#6b7280` | `rgba(107, 114, 128, 0.1)` | `#6b7280` |

### 7.3 Notification Type Icons

| Type | Icon | Background | Color |
|------|------|------------|-------|
| task_assignment | `User` | `bg-blue-100` | `text-blue-600` |
| task_completion | `CheckCircle` | `bg-green-100` | `text-green-600` |
| task_reassignment | `RefreshCw` | `bg-blue-100` | `text-blue-600` |

### 7.4 Dark Mode Support

```tsx
// Card background
bg-white dark:bg-gray-800

// Border
border-gray-200 dark:border-gray-700

// Text colors
text-gray-900 dark:text-white          // Primary
text-gray-500 dark:text-gray-400       // Secondary
text-gray-400 dark:text-gray-500       // Muted

// Icon backgrounds
bg-blue-100 dark:bg-blue-900/30
bg-green-100 dark:bg-green-900/30
```

---

## 8. Performance Considerations

### 8.1 Memoization Strategy

```typescript
// TaskAssignmentCard is memoized to prevent unnecessary re-renders
export const TaskAssignmentCard = memo(function TaskAssignmentCard({...}) {
  // Component implementation
});
```

### 8.2 Callback Stability

```typescript
// All callbacks wrapped in useCallback
const handleCardClick = useCallback(() => {
  onViewTask();
}, [onViewTask]);

const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onViewTask();
  }
}, [onViewTask]);

const handleButtonClick = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  onViewTask();
}, [onViewTask]);
```

### 8.3 todosMap Optimization

```typescript
// In parent component (TodoList.tsx)
const todosMap = useMemo(
  () => new Map(todos.map(t => [t.id, t])),
  [todos]  // Only recompute when todos array changes
);
```

**Lookup Complexity:**
- Without Map: O(n) per message × O(m) messages = O(n×m)
- With Map: O(1) per message × O(m) messages = O(m)

### 8.4 Bundle Size Impact

| Addition | Estimated Size | Notes |
|----------|----------------|-------|
| TaskAssignmentCard.tsx | ~4KB | Including imports |
| chat/index.ts | ~0.1KB | Barrel export |
| Type additions | ~0.5KB | Inlined at build |
| ChatPanel changes | ~0.5KB | New logic |
| **Total** | **~5KB** | Acceptable |

---

## 9. Implementation Guidelines

### 9.1 Implementation Order

```
Phase 1: Type Definitions (15 min)
├── 1.1 Add SystemNotificationType to src/types/todo.ts
├── 1.2 Add SystemMessageMetadata interface
└── 1.3 Add isSystemNotification() helper function

Phase 2: TaskAssignmentCard Component (2-3 hrs)
├── 2.1 Create src/components/chat/ directory
├── 2.2 Create TaskAssignmentCard.tsx
├── 2.3 Create index.ts barrel export
└── 2.4 Test component in isolation

Phase 3: ChatPanel Integration (1-2 hrs)
├── 3.1 Add todosMap prop to ChatPanelProps
├── 3.2 Update TodoList.tsx to pass todosMap
├── 3.3 Import TaskAssignmentCard in ChatPanel
├── 3.4 Add parseSystemMessage() helper
├── 3.5 Update message rendering with conditional
└── 3.6 Test integration end-to-end

Phase 4: Testing & Polish (1 hr)
├── 4.1 Accessibility testing (VoiceOver/NVDA)
├── 4.2 Keyboard navigation testing
├── 4.3 Visual testing (light/dark mode)
└── 4.4 Edge case testing
```

### 9.2 Code Review Checklist

**Accessibility:**
- [ ] Card has `role="button"` and `tabIndex={0}`
- [ ] Card has descriptive `aria-label`
- [ ] All icons have `aria-hidden="true"`
- [ ] Subtask status has `.sr-only` text
- [ ] View Task button has `aria-label`
- [ ] No emojis in accessible name

**Visual:**
- [ ] Priority color bar matches TodoItem style
- [ ] Badge shows only for urgent/high priority
- [ ] Due date shows overdue warning styling
- [ ] Notes truncate at 2 lines
- [ ] Subtasks truncate at 3 with "+N more"
- [ ] Dark mode styling is correct

**Functionality:**
- [ ] Card click opens task
- [ ] Button click opens task (no double-fire)
- [ ] Enter/Space keyboard activation works
- [ ] Fallback to text when todo not found
- [ ] System messages without related_todo_id not affected

**Integration:**
- [ ] todosMap prop flows from TodoList
- [ ] parseSystemMessage handles all notification types
- [ ] Non-system messages render as before
- [ ] View Task button hidden for card-rendered messages

### 9.3 Pattern Alignment

The implementation follows existing patterns from:

1. **ArchivedTaskModal.tsx** - PRIORITY_CONFIG usage
2. **TaskCompletionSummary.tsx** - Focus trap, keyboard handling
3. **ConfirmDialog.tsx** - Accessible dialog patterns
4. **ChatPanel.tsx** - Message bubble styling patterns

---

## 10. Testing Strategy

### 10.1 Unit Tests (Recommended)

**TaskAssignmentCard.test.tsx:**
```typescript
describe('TaskAssignmentCard', () => {
  describe('Rendering', () => {
    it('renders task title and priority');
    it('shows priority badge only for urgent/high');
    it('shows due date when present');
    it('shows overdue warning for past due dates');
    it('truncates subtasks at 3 with +N more');
    it('truncates notes at 2 lines');
    it('shows different header for each notification type');
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes');
    it('provides descriptive aria-label');
    it('hides icons from screen readers');
    it('provides sr-only text for subtask status');
  });

  describe('Interaction', () => {
    it('calls onViewTask when card is clicked');
    it('calls onViewTask on Enter key');
    it('calls onViewTask on Space key');
    it('calls onViewTask when button is clicked');
    it('does not double-fire on button click');
  });
});
```

**parseSystemMessage.test.ts:**
```typescript
describe('parseSystemMessage', () => {
  it('returns null for non-system messages');
  it('returns null for system messages without related_todo_id');
  it('parses task_assignment from "New Task Assigned"');
  it('parses task_completion from "Task Completed"');
  it('parses task_reassignment from "Task Reassigned"');
  it('extracts actionBy from "From: Username"');
  it('extracts actionBy from "By: Username"');
});
```

### 10.2 Manual Testing Checklist

**Accessibility Testing:**
- [ ] Screen reader announces card without emoji names (VoiceOver)
- [ ] Screen reader announces card without emoji names (NVDA)
- [ ] Card is keyboard navigable (Tab to reach)
- [ ] Enter key activates card
- [ ] Space key activates card
- [ ] Focus ring is visible in light mode
- [ ] Focus ring is visible in dark mode

**Functional Testing:**
- [ ] Card renders for task assignment notifications
- [ ] Card renders for task completion notifications
- [ ] Card renders for task reassignment notifications
- [ ] Clicking card opens the linked task
- [ ] "View Task" button opens the linked task
- [ ] Fallback to text message when todo deleted
- [ ] Card shows correct priority color bar
- [ ] Overdue tasks show warning styling

**Visual Testing:**
- [ ] Card matches TodoItem visual style
- [ ] Dark mode styling is correct
- [ ] Card is full width on mobile
- [ ] Card is max 320px on desktop
- [ ] Priority badge shows for urgent/high only
- [ ] Animation on card appearance is smooth

**Edge Cases:**
- [ ] Task with no subtasks renders correctly
- [ ] Task with no notes renders correctly
- [ ] Task with no due date renders correctly
- [ ] Very long task titles wrap appropriately
- [ ] Task with 10+ subtasks shows "+N more"
- [ ] Old messages (before feature) still work

---

## 11. Error Handling & Fallbacks

### 11.1 Graceful Degradation

```
Scenario                          | Behavior
──────────────────────────────────┼─────────────────────────────────
Todo exists in todosMap           | Render TaskAssignmentCard
Todo not in todosMap              | Render standard text bubble
Todo was deleted after message    | Render standard text bubble
parseSystemMessage returns null   | Render standard text bubble
onTaskLinkClick not provided      | Card renders without navigation
todosMap prop not provided        | All messages render as text
```

### 11.2 Error Boundaries (Optional)

```typescript
// If needed, wrap card in error boundary
<ErrorBoundary fallback={<StandardMessageBubble msg={msg} />}>
  <TaskAssignmentCard ... />
</ErrorBoundary>
```

---

## 12. Rollback Plan

### 12.1 Quick Disable

In ChatPanel.tsx, change condition to always use fallback:
```typescript
if (false && systemMeta && linkedTodo) {  // Disabled
  return <TaskAssignmentCard ... />;
}
```

### 12.2 Full Rollback

1. Remove TaskAssignmentCard import from ChatPanel.tsx
2. Remove parseSystemMessage helper function
3. Remove conditional rendering logic
4. Restore original message bubble rendering
5. Remove todosMap prop usage (optional - doesn't hurt to keep)

**Rollback Time:** ~10 minutes
**Database Migration Required:** No
**Risk:** Low

---

## 13. Future Enhancements

### 13.1 Structured Metadata (Phase 2)

Add JSON metadata prefix to messages for cleaner parsing:
```typescript
// Message format:
// <!--META:{"type":"task_assignment","taskId":"uuid",...}-->Human readable text

function buildTaskCardMessage(options: TaskCardMessageOptions): string {
  const metadata: SystemMessageMetadata = {
    type: mapTypeToEnum(options.type),
    taskId: options.taskId,
    actionBy: options.assignedBy || options.completedBy || options.reassignedBy,
    renderAsCard: true,
  };

  const humanReadable = buildHumanReadableMessage(options);
  return `<!--META:${JSON.stringify(metadata)}-->${humanReadable}`;
}
```

### 13.2 Reusability Opportunities

TaskAssignmentCard can be reused in:
- Activity feed (different layout, same component)
- Email notifications (render as HTML)
- Push notification previews
- Task mention cards in chat

### 13.3 Real-time Task Updates

Because cards render from live `todosMap` data, they automatically reflect:
- Priority changes
- Due date changes
- Subtask completion progress
- Notes updates

---

## 14. Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Tech Lead | | 2026-01-15 | Ready for Review |
| Frontend Lead | | | Pending |
| Accessibility Lead | | | Pending |

---

**Document Prepared By:** Tech Lead
**Next Steps:** Frontend Engineer implementation
**Estimated Completion:** 4-6 hours from start
