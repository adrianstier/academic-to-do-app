# TaskCompletionSummary Technical Architecture

**Version:** 1.0
**Created:** 2026-01-14
**Author:** Tech Lead
**Status:** Ready for Implementation
**Risk Level:** Low
**Estimated Effort:** 3-4 days

---

## Executive Summary

This document provides the technical architecture and implementation guidelines for the TaskCompletionSummary UX improvements. The changes focus on accessibility (WCAG 2.1 AA compliance), keyboard navigation, error handling, and user preference persistence.

### Architectural Impact Assessment

| Category | Impact | Risk |
|----------|--------|------|
| Database | None | N/A |
| API | None | N/A |
| State Management | Minor (localStorage) | Low |
| Component Structure | Medium (new hooks) | Low |
| Testing | Medium (new test cases) | Low |
| Bundle Size | Minimal (+~2KB) | Low |

---

## 1. Architecture Overview

### 1.1 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TaskCompletionSummary                        │
│                      (Modal Component)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐│
│  │  useFocusTrap    │  │ useKeyboard      │  │ localStorage  ││
│  │  (new hook)      │  │ Shortcuts        │  │ (preferences) ││
│  │                  │  │ (new hook)       │  │               ││
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘│
│           │                     │                     │        │
│           └─────────────────────┼─────────────────────┘        │
│                                 ▼                              │
│                    ┌────────────────────────┐                  │
│                    │  TaskCompletionSummary │                  │
│                    │  Component State       │                  │
│                    │  - selectedFormat      │                  │
│                    │  - copied              │                  │
│                    │  - copyError           │                  │
│                    │  - statusMessage       │                  │
│                    │  - showPreview         │                  │
│                    └────────────┬───────────┘                  │
│                                 │                              │
│                    ┌────────────▼───────────┐                  │
│                    │  summaryGenerator.ts   │                  │
│                    │  - generateSummary()   │                  │
│                    │  - copyToClipboard()   │                  │
│                    │  - getPreferredFormat()│                  │
│                    │  - setPreferredFormat()│                  │
│                    └────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
User Interaction
       │
       ├─► Format Selection ──► setPreferredFormat() ──► localStorage
       │                                │
       │                                ▼
       │                        generateSummary()
       │                                │
       │                                ▼
       │                          summaryText
       │
       ├─► Copy Action ─────► copyToClipboard()
       │                                │
       │                    ┌───────────┴───────────┐
       │                    │                       │
       │                Success                   Error
       │                    │                       │
       │                    ▼                       ▼
       │              setCopied(true)        setCopyError(true)
       │                    │                       │
       │                    └───────────┬───────────┘
       │                                │
       │                                ▼
       │                        setStatusMessage()
       │                                │
       │                                ▼
       │                       aria-live region
       │                       (screen reader)
       │
       └─► Keyboard (Escape) ──► onClose()
```

---

## 2. File Structure & Modifications

### 2.1 Files to Create

```
src/hooks/
├── useFocusTrap.ts          # NEW - Modal focus management
├── useKeyboardShortcuts.ts  # NEW - Global keyboard shortcuts
└── index.ts                 # MODIFY - Export new hooks
```

### 2.2 Files to Modify

```
src/lib/
└── summaryGenerator.ts      # MODIFY - Add preference persistence

src/components/
└── TaskCompletionSummary.tsx # MODIFY - Apply UX improvements

src/types/
└── todo.ts                   # OPTIONAL - Add SummaryFormat type (already exists)
```

### 2.3 Dependency Map

```
                    ┌─────────────────────────────┐
                    │ TaskCompletionSummary.tsx   │
                    └──────────────┬──────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────┐
│ useFocusTrap.ts  │  │ useKeyboardShortcuts │  │ summaryGenerator │
│                  │  │        .ts           │  │      .ts         │
│ Dependencies:    │  │                      │  │                  │
│ - React hooks    │  │ Dependencies:        │  │ Dependencies:    │
│                  │  │ - React hooks        │  │ - date-fns       │
│ Exports:         │  │                      │  │ - types/todo.ts  │
│ - useFocusTrap   │  │ Exports:             │  │                  │
└──────────────────┘  │ - useKeyboard        │  │ NEW Exports:     │
                      │   Shortcuts          │  │ - getPreferred   │
                      └──────────────────────┘  │   Format()       │
                                                │ - setPreferred   │
                                                │   Format()       │
                                                └──────────────────┘
```

---

## 3. Component Architecture

### 3.1 State Management

**Current State Variables:**
```typescript
const [copied, setCopied] = useState(false);
const [showPreview, setShowPreview] = useState(true);
const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>('text');
```

**New State Variables:**
```typescript
const [copied, setCopied] = useState(false);
const [copyError, setCopyError] = useState(false);          // NEW
const [showPreview, setShowPreview] = useState(true);
const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(
  () => getPreferredFormat()                                  // MODIFIED
);
const [statusMessage, setStatusMessage] = useState<string | null>(null); // NEW
```

### 3.2 State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                    Copy Button States                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   IDLE ──────────► COPYING ──────────► SUCCESS                  │
│    │                  │                   │                     │
│    │                  │              (2s timeout)               │
│    │                  │                   │                     │
│    │                  │                   ▼                     │
│    │                  │               ◄── IDLE                  │
│    │                  │                                         │
│    │                  ▼                                         │
│    │               ERROR ─────────────────────► IDLE            │
│    │                              (4s timeout)                  │
│    │                                                            │
│    └──────────────────────────────────────────────►             │
│                                                                 │
│   Visual States:                                                │
│   - IDLE:    Blue button, "Copy Summary"                        │
│   - SUCCESS: Green button, "Copied!" with checkmark             │
│   - ERROR:   Red button, "Try Again" with alert icon            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Focus Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Modal Focus Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Modal Opens                                                │
│      │                                                          │
│      ▼                                                          │
│   Store previousActiveElement                                   │
│      │                                                          │
│      ▼                                                          │
│   Focus "Copy Summary" button (data-primary-action)             │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────────────────────────────────┐                   │
│   │           Focus Trap Active             │                   │
│   │                                         │                   │
│   │   Tab: Close → Formats → View → Copy    │                   │
│   │        └─────────────────────────┘      │                   │
│   │                                         │                   │
│   │   Shift+Tab: Reverse order              │                   │
│   │   Escape: Close modal                   │                   │
│   └─────────────────────────────────────────┘                   │
│      │                                                          │
│      ▼                                                          │
│   2. Modal Closes                                               │
│      │                                                          │
│      ▼                                                          │
│   Restore focus to previousActiveElement                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Hook Specifications

### 4.1 useFocusTrap Hook

**Purpose:** Trap keyboard focus within modal, handle Escape key, manage focus restoration

**Interface:**
```typescript
interface UseFocusTrapOptions {
  onEscape?: () => void;
  autoFocus?: boolean;
}

function useFocusTrap<T extends HTMLElement>(
  options?: UseFocusTrapOptions
): React.RefObject<T>;
```

**Behavior:**
1. On mount: Store currently focused element
2. On mount: Focus first focusable element (or element with `data-primary-action`)
3. On Tab: Cycle focus within container
4. On Escape: Call `onEscape` callback
5. On unmount: Restore focus to original element

**Focusable Element Selector:**
```typescript
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');
```

### 4.2 useKeyboardShortcuts Hook

**Purpose:** Register global keyboard shortcuts with modifier key support

**Interface:**
```typescript
interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled?: boolean
): void;
```

**Behavior:**
1. Cross-platform: Support both Ctrl (Windows/Linux) and Cmd (Mac)
2. Prevent default browser behavior when shortcut matches
3. Disabled when `enabled` is false

**Registered Shortcuts for TaskCompletionSummary:**
| Shortcut | Action | Description |
|----------|--------|-------------|
| Cmd/Ctrl+C | handleCopy | Copy summary to clipboard |
| Escape | onClose | Close modal (handled by focus trap) |

---

## 5. Accessibility Requirements (WCAG 2.1 AA)

### 5.1 ARIA Attributes Matrix

| Element | Required Attributes | Purpose |
|---------|---------------------|---------|
| Modal container | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` | Identify as modal dialog |
| Title | `id="summary-modal-title"` | Label for dialog |
| Description | `id="summary-modal-description"` | Description for dialog |
| Close button | `aria-label="Close task summary modal"` | Accessible name |
| Format buttons | `aria-pressed`, `aria-label` | Toggle button state |
| View tabs | `role="tab"`, `aria-selected`, `aria-controls` | Tab semantics |
| Tab panels | `role="tabpanel"`, `id` | Associated content |
| Status region | `role="status"`, `aria-live="polite"`, `aria-atomic="true"` | Live announcements |
| Icons | `aria-hidden="true"` | Hide decorative icons |

### 5.2 Focus Indicators

All interactive elements must have visible focus indicators:

```css
/* Focus ring pattern (Tailwind classes) */
focus:outline-none
focus:ring-2
focus:ring-blue-500
focus:ring-offset-2
dark:focus:ring-offset-gray-800
```

### 5.3 Color Independence

Selected format must be distinguishable without color:
- Ring/border indicator (not just background color)
- Checkmark icon on selected option

### 5.4 Screen Reader Announcements

| Event | Announcement |
|-------|--------------|
| Copy success | "{FORMAT} summary copied to clipboard" |
| Copy failure | "Failed to copy to clipboard. Please try selecting and copying manually." |
| Format change | Announced via `aria-pressed` state change |

---

## 6. localStorage Schema

### 6.1 Preference Storage

**Key:** `todo_summary_format_preference`

**Type:** `SummaryFormat` (`'text' | 'markdown' | 'json' | 'csv'`)

**Default:** `'text'`

**Implementation:**
```typescript
const FORMAT_PREFERENCE_KEY = 'todo_summary_format_preference';

export function getPreferredFormat(): SummaryFormat {
  if (typeof window === 'undefined') return 'text';

  try {
    const stored = localStorage.getItem(FORMAT_PREFERENCE_KEY);
    if (stored && ['text', 'markdown', 'json', 'csv'].includes(stored)) {
      return stored as SummaryFormat;
    }
  } catch (error) {
    console.warn('Failed to read format preference:', error);
  }

  return 'text';
}

export function setPreferredFormat(format: SummaryFormat): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(FORMAT_PREFERENCE_KEY, format);
  } catch (error) {
    console.warn('Failed to save format preference:', error);
  }
}
```

### 6.2 Error Handling

- SSR-safe: Check for `window` before accessing `localStorage`
- Graceful degradation: Return default value on error
- Non-blocking: Don't throw exceptions for preference failures

---

## 7. Error Handling Strategy

### 7.1 Copy to Clipboard Error Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                 Clipboard Error Handling                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   copyToClipboard()                                             │
│        │                                                        │
│        ├──► navigator.clipboard.writeText() ──► Success         │
│        │              │                                         │
│        │              ▼ (fails)                                 │
│        │                                                        │
│        ├──► Fallback: execCommand('copy') ──► Success           │
│        │              │                                         │
│        │              ▼ (fails)                                 │
│        │                                                        │
│        └──► Return false ──► setCopyError(true)                 │
│                              setStatusMessage(error message)    │
│                                   │                             │
│                              4 second timeout                   │
│                                   │                             │
│                                   ▼                             │
│                              setCopyError(false)                │
│                              setStatusMessage(null)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Error States Visual Design

| State | Button Color | Icon | Text |
|-------|--------------|------|------|
| Idle | Blue (`bg-blue-600`) | Copy | "Copy Summary ⌘C" |
| Success | Green (`bg-green-500`) | Check | "Copied!" |
| Error | Red (`bg-red-500`) | AlertCircle | "Try Again" |

---

## 8. Performance Considerations

### 8.1 Memoization Strategy

```typescript
// Already memoized - no changes needed
const summaryText = useMemo(
  () => generateSummary(todo, completedBy, selectedFormat),
  [todo, completedBy, selectedFormat]
);
```

### 8.2 Event Listener Cleanup

Both hooks must clean up event listeners on unmount:

```typescript
// useFocusTrap
useEffect(() => {
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);

// useKeyboardShortcuts
useEffect(() => {
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [shortcuts, enabled]);
```

### 8.3 Bundle Size Impact

| Addition | Estimated Size | Notes |
|----------|----------------|-------|
| useFocusTrap.ts | ~1KB | Pure logic, no deps |
| useKeyboardShortcuts.ts | ~0.5KB | Pure logic, no deps |
| AlertCircle icon | Already imported | Part of lucide-react |
| Component changes | ~0.5KB | Additional JSX/logic |
| **Total** | **~2KB** | Negligible impact |

---

## 9. Implementation Guidelines

### 9.1 Implementation Order

```
Phase 1: Create Hooks (No dependencies)
├── 1.1 Create src/hooks/useFocusTrap.ts
├── 1.2 Create src/hooks/useKeyboardShortcuts.ts
└── 1.3 Update src/hooks/index.ts exports

Phase 2: Update summaryGenerator.ts
└── 2.1 Add getPreferredFormat() and setPreferredFormat()

Phase 3: Update TaskCompletionSummary.tsx
├── 3.1 Add ARIA attributes (Phase 1 from UX plan)
├── 3.2 Integrate focus trap hook (Phase 2 from UX plan)
├── 3.3 Integrate keyboard shortcuts hook (Phase 2 from UX plan)
├── 3.4 Add error handling (Phase 3 from UX plan)
├── 3.5 Add preference persistence (Phase 4 from UX plan)
└── 3.6 Apply visual polish (Phase 5 from UX plan)

Phase 4: Testing
├── 4.1 Manual accessibility testing
├── 4.2 Keyboard navigation testing
└── 4.3 Cross-browser testing
```

### 9.2 Code Review Checklist

**Accessibility:**
- [ ] All interactive elements have visible focus indicators
- [ ] Modal has proper ARIA attributes (`role`, `aria-modal`, `aria-labelledby`, `aria-describedby`)
- [ ] Screen reader announcements work via `aria-live` region
- [ ] Format selection is distinguishable without color
- [ ] Close button has accessible name

**Keyboard Navigation:**
- [ ] Focus is trapped within modal when open
- [ ] Tab cycles through all interactive elements
- [ ] Shift+Tab cycles in reverse
- [ ] Escape closes the modal
- [ ] Cmd/Ctrl+C copies summary
- [ ] Focus returns to trigger element on close

**Error Handling:**
- [ ] Copy failure shows error state
- [ ] Error state is announced to screen readers
- [ ] Error state auto-clears after 4 seconds
- [ ] Preference save failures are logged but don't break functionality

**User Preferences:**
- [ ] Format preference persists across page refreshes
- [ ] Default format is 'text' when no preference exists
- [ ] SSR-safe (no errors during server rendering)

### 9.3 Existing Pattern Alignment

The implementation should follow existing patterns from `ConfirmDialog.tsx`:

1. **Focus trap implementation** - Use inline `useEffect` pattern (lines 31-67)
2. **Escape key handling** - Same pattern as ConfirmDialog
3. **Focus restoration** - Store and restore `document.activeElement`
4. **Backdrop click handling** - `onClick={onCancel}` with `aria-hidden="true"`

---

## 10. Testing Strategy

### 10.1 Unit Tests (Recommended)

**useFocusTrap.test.ts:**
```typescript
describe('useFocusTrap', () => {
  it('should focus first focusable element on mount');
  it('should focus data-primary-action element when present');
  it('should trap tab navigation within container');
  it('should handle shift+tab navigation');
  it('should call onEscape when Escape is pressed');
  it('should restore focus to previous element on unmount');
});
```

**useKeyboardShortcuts.test.ts:**
```typescript
describe('useKeyboardShortcuts', () => {
  it('should call action when shortcut is pressed');
  it('should support Ctrl modifier');
  it('should support Meta (Cmd) modifier');
  it('should not call action when disabled');
  it('should prevent default on matching shortcuts');
});
```

### 10.2 Integration Tests

**TaskCompletionSummary.test.tsx:**
```typescript
describe('TaskCompletionSummary', () => {
  describe('Accessibility', () => {
    it('should have proper dialog role and ARIA attributes');
    it('should announce copy success to screen readers');
    it('should announce copy error to screen readers');
  });

  describe('Keyboard Navigation', () => {
    it('should trap focus within modal');
    it('should close on Escape key');
    it('should copy on Cmd+C / Ctrl+C');
  });

  describe('User Preferences', () => {
    it('should remember format selection');
    it('should default to text format');
  });

  describe('Error Handling', () => {
    it('should show error state when copy fails');
    it('should auto-clear error state');
  });
});
```

### 10.3 Manual Testing Checklist

See UX plan for complete checklist. Key items:

**Screen Reader Testing (VoiceOver/NVDA):**
- [ ] Modal title and description announced on open
- [ ] Format selection state changes announced
- [ ] Copy success/failure announced

**Browser Compatibility:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## 11. Rollback Plan

If issues are discovered post-deployment:

1. **Immediate rollback:** Revert the commit for TaskCompletionSummary.tsx
2. **Hooks are isolated:** useFocusTrap and useKeyboardShortcuts can remain as they don't affect other components
3. **Preferences backward compatible:** Existing localStorage data won't cause issues

---

## 12. Future Considerations

### 12.1 Hooks Reusability

The new hooks can be applied to other modals in the codebase:
- `CustomerEmailModal`
- `SmartParseModal`
- `SaveTemplateModal`
- `DuplicateDetectionModal`
- `AttachmentUpload`
- `ConfirmDialog` (already has inline implementation)

### 12.2 Potential Enhancements

1. **Toast notifications:** Consider creating a reusable Toast component for copy feedback
2. **Centralized preferences:** Move user preferences to a context/store if more settings are added
3. **Analytics:** Track format usage to understand user preferences

---

## 13. Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Tech Lead | | | Ready for Review |
| Frontend Lead | | | Pending |
| Accessibility Lead | | | Pending |

---

**Document Prepared By:** Tech Lead
**Next Steps:** Frontend Engineer implementation
**Estimated Completion:** 3-4 days from start
