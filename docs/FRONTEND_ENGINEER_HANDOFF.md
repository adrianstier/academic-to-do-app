# Frontend Engineer Handoff: TaskCompletionSummary UX Improvements

**Version:** 1.0
**Created:** 2026-01-14
**Prepared By:** Data Scientist (Pipeline Review)
**Target Recipient:** Frontend Engineer
**Status:** Ready for Implementation

---

## Quick Start

This document summarizes everything you need to implement the TaskCompletionSummary UX improvements. The primary specification is in [TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md](./TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md).

### TL;DR - What You're Building

| Feature | Description | Complexity |
|---------|-------------|------------|
| Focus trap hook | Keyboard focus stays within modal | Medium |
| Keyboard shortcuts | Cmd/Ctrl+C to copy, Escape to close | Low |
| Error handling | Show error state when copy fails | Low |
| Preference persistence | Remember last format selection | Low |
| ARIA accessibility | Screen reader support | Medium |

### Estimated Effort: 3-4 days

---

## 1. Files to Create

### 1.1 `src/hooks/useFocusTrap.ts`

**Purpose:** Trap keyboard focus within modal, handle Escape key

**Reference Pattern:** Look at `ConfirmDialog.tsx` lines 31-67 for inline implementation to extract

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

**Key Behaviors:**
- Store `document.activeElement` on mount
- Focus `[data-primary-action]` element on mount (Copy button)
- Tab cycles through focusable elements
- Shift+Tab cycles in reverse
- Escape calls `onEscape` callback
- Restore focus on unmount

### 1.2 `src/hooks/useKeyboardShortcuts.ts`

**Purpose:** Register global keyboard shortcuts

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

**Key Behaviors:**
- Support both Ctrl (Windows/Linux) and Cmd (Mac)
- Call `preventDefault()` when shortcut matches
- No-op when `enabled` is false

### 1.3 `src/hooks/index.ts` (Update)

Export the new hooks:
```typescript
export { useFocusTrap } from './useFocusTrap';
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
```

---

## 2. Files to Modify

### 2.1 `src/lib/summaryGenerator.ts`

**Add these exports at the end of the file:**

```typescript
// --- User Preference Persistence ---
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

### 2.2 `src/components/TaskCompletionSummary.tsx`

**Full modification checklist:**

#### State Changes
```typescript
// CURRENT
const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>('text');

// CHANGE TO
const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(
  () => getPreferredFormat()
);
const [copyError, setCopyError] = useState(false);
const [statusMessage, setStatusMessage] = useState<string | null>(null);
```

#### Add Imports
```typescript
import { AlertCircle } from 'lucide-react';
import { getPreferredFormat, setPreferredFormat } from '@/lib/summaryGenerator';
// OR import new hooks when created:
// import { useFocusTrap, useKeyboardShortcuts } from '@/hooks';
```

#### Handle Format Change with Persistence
```typescript
const handleFormatChange = (format: SummaryFormat) => {
  setSelectedFormat(format);
  setPreferredFormat(format);  // Persist to localStorage
};
```

#### Update Copy Handler
```typescript
const handleCopy = async () => {
  const success = await copyToClipboard(summaryText);
  if (success) {
    setCopied(true);
    setCopyError(false);
    setStatusMessage(`${selectedFormat.toUpperCase()} summary copied to clipboard`);
    setTimeout(() => {
      setCopied(false);
      setStatusMessage(null);
    }, 2000);
  } else {
    setCopyError(true);
    setStatusMessage('Failed to copy to clipboard. Please try selecting and copying manually.');
    setTimeout(() => {
      setCopyError(false);
      setStatusMessage(null);
    }, 4000);
  }
};
```

#### Add ARIA Attributes to Modal Container
```tsx
<motion.div
  role="dialog"
  aria-modal="true"
  aria-labelledby="summary-modal-title"
  aria-describedby="summary-modal-description"
  // ... rest of props
>
```

#### Add Screen Reader Status Region
```tsx
{/* Add inside modal, before closing </motion.div> */}
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {statusMessage}
</div>
```

#### Update Copy Button Visual States
```tsx
<button
  onClick={handleCopy}
  data-primary-action  // For focus trap
  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
    copyError
      ? 'bg-red-500 text-white'
      : copied
        ? 'bg-green-500 text-white'
        : 'bg-blue-600 text-white hover:bg-blue-700'
  }`}
>
  {copyError ? (
    <>
      <AlertCircle className="w-4 h-4" aria-hidden="true" />
      Try Again
    </>
  ) : copied ? (
    <>
      <Check className="w-4 h-4" aria-hidden="true" />
      Copied!
    </>
  ) : (
    <>
      <Copy className="w-4 h-4" aria-hidden="true" />
      Copy Summary
      <kbd className="ml-1 text-xs opacity-70">⌘C</kbd>
    </>
  )}
</button>
```

#### Add Focus Indicators to All Interactive Elements

Add to close button, format buttons, and view toggle buttons:
```tsx
className="... focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
```

---

## 3. Accessibility Checklist

### Required ARIA Attributes

| Element | Attribute | Value |
|---------|-----------|-------|
| Modal container | `role` | `"dialog"` |
| Modal container | `aria-modal` | `"true"` |
| Modal container | `aria-labelledby` | `"summary-modal-title"` |
| Modal container | `aria-describedby` | `"summary-modal-description"` |
| Title h2 | `id` | `"summary-modal-title"` |
| Description p | `id` | `"summary-modal-description"` |
| Close button | `aria-label` | `"Close task summary modal"` |
| Format buttons | `aria-pressed` | `{selectedFormat === option.value}` |
| View tabs | `role` | `"tab"` |
| View tabs | `aria-selected` | `{showPreview}` / `{!showPreview}` |
| Status region | `role` | `"status"` |
| Status region | `aria-live` | `"polite"` |
| Icons | `aria-hidden` | `"true"` |

### Focus Indicator CSS Pattern

```css
/* Tailwind classes for all interactive elements */
focus:outline-none
focus:ring-2
focus:ring-blue-500
focus:ring-offset-2
dark:focus:ring-offset-gray-800
```

---

## 4. Testing Checklist

### Keyboard Navigation
- [ ] Tab cycles through: Close → Format buttons → View toggle → Copy
- [ ] Shift+Tab cycles in reverse
- [ ] Escape closes modal
- [ ] Cmd/Ctrl+C copies summary
- [ ] Focus returns to trigger element on close

### Screen Reader (Test with VoiceOver on Mac)
- [ ] Modal title announced on open
- [ ] "Dialog" role announced
- [ ] Format button states announced (pressed/not pressed)
- [ ] Copy success/failure announced
- [ ] Close action announced

### Error States
- [ ] Disable clipboard API in browser DevTools → Copy shows error state
- [ ] Error state shows "Try Again" with red background
- [ ] Error auto-clears after 4 seconds

### Preference Persistence
- [ ] Select format → Refresh page → Same format selected
- [ ] Clear localStorage → Default to 'text'

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## 5. Implementation Order

```
Phase 1: Create Hooks (no dependencies)
├── 1.1 src/hooks/useFocusTrap.ts
├── 1.2 src/hooks/useKeyboardShortcuts.ts
└── 1.3 Update src/hooks/index.ts

Phase 2: Update summaryGenerator.ts
└── 2.1 Add getPreferredFormat() and setPreferredFormat()

Phase 3: Update TaskCompletionSummary.tsx
├── 3.1 Add ARIA attributes
├── 3.2 Integrate focus trap
├── 3.3 Integrate keyboard shortcuts
├── 3.4 Add error handling states
├── 3.5 Add preference persistence
└── 3.6 Add focus indicators

Phase 4: Testing
├── 4.1 Manual keyboard navigation
├── 4.2 Screen reader testing
└── 4.3 Cross-browser testing
```

---

## 6. Reference Files

| File | Purpose |
|------|---------|
| [TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md](./TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md) | Full technical spec |
| [src/components/ConfirmDialog.tsx](../src/components/ConfirmDialog.tsx) | Focus trap reference pattern |
| [src/lib/summaryGenerator.ts](../src/lib/summaryGenerator.ts) | Add preference functions here |
| [src/components/TaskCompletionSummary.tsx](../src/components/TaskCompletionSummary.tsx) | Main component to modify |

---

## 7. Questions? Edge Cases?

### Q: What if hooks already exist?
A: Check `src/hooks/` directory. If similar hooks exist, extend them rather than creating duplicates.

### Q: What about analytics?
A: Analytics tracking is **optional and deferred**. See [DATA_SCIENCE_ANALYTICS_SCHEMA.md](./DATA_SCIENCE_ANALYTICS_SCHEMA.md) for future implementation. Do NOT implement analytics in this sprint.

### Q: What if useFocusTrap conflicts with Framer Motion?
A: The focus trap should work with Framer Motion's AnimatePresence. Test that focus is set AFTER the enter animation completes.

### Q: Should I update other modals?
A: No. The hooks are designed for reuse, but only apply to TaskCompletionSummary in this sprint. Other modals can adopt later.

---

## 8. Definition of Done

- [ ] All accessibility tests pass
- [ ] All keyboard navigation tests pass
- [ ] Preference persistence works
- [ ] Error handling works
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Code reviewed and approved
- [ ] Manual QA completed

---

**Document Prepared By:** Data Scientist (Pipeline Handoff)
**Primary Spec:** [TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md](./TASK_COMPLETION_SUMMARY_TECH_ARCHITECTURE.md)
**Start Date:** When assigned by Tech Lead

