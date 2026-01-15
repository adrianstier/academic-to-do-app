# TaskCompletionSummary UX Improvement Plan

**Version:** 1.0
**Created:** 2026-01-14
**Author:** UX Engineer
**Timeline:** 3-4 days
**Risk Level:** Low
**User Impact:** Enhanced accessibility and usability

---

## Executive Summary

This plan addresses UX improvements for the `TaskCompletionSummary` component, focusing on accessibility compliance (WCAG 2.1 AA), keyboard navigation, error handling, and user preference persistence. All changes are backward compatible and can be implemented incrementally.

**Files to Modify:**
- `src/components/TaskCompletionSummary.tsx` (primary)
- `src/lib/summaryGenerator.ts` (minor additions)
- `src/types/todo.ts` (type additions)

**New Files:**
- `src/hooks/useFocusTrap.ts`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/components/ui/Toast.tsx` (if not exists)

---

## Implementation Phases

### Phase 1: Accessibility Critical Fixes (Priority: HIGH)
**Estimated Time:** 2-3 hours
**Dependency:** None

### Phase 2: Keyboard Support (Priority: HIGH)
**Estimated Time:** 1-2 hours
**Dependency:** Phase 1

### Phase 3: Error Handling & Feedback (Priority: HIGH)
**Estimated Time:** 1-2 hours
**Dependency:** None (can parallel with Phase 1)

### Phase 4: User Preferences (Priority: MEDIUM)
**Estimated Time:** 1 hour
**Dependency:** None

### Phase 5: Visual Polish (Priority: LOW)
**Estimated Time:** 1-2 hours
**Dependency:** Phases 1-4

---

## Phase 1: Accessibility Critical Fixes

### Task 1.1: Add ARIA Dialog Semantics

**File:** `src/components/TaskCompletionSummary.tsx`

**Current Code (lines 60-67):**
```tsx
<motion.div
  initial={{ scale: 0.95, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.95, opacity: 0 }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
  className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
  onClick={(e) => e.stopPropagation()}
>
```

**Updated Code:**
```tsx
<motion.div
  role="dialog"
  aria-modal="true"
  aria-labelledby="summary-modal-title"
  aria-describedby="summary-modal-description"
  initial={{ scale: 0.95, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.95, opacity: 0 }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
  className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
  onClick={(e) => e.stopPropagation()}
>
```

**Header Update (lines 74-81):**
```tsx
<div>
  <h2
    id="summary-modal-title"
    className="text-lg font-semibold text-gray-900 dark:text-white"
  >
    Task Summary
  </h2>
  <p
    id="summary-modal-description"
    className="text-sm text-gray-500 dark:text-gray-400"
  >
    Copy to paste into your database
  </p>
</div>
```

---

### Task 1.2: Add Accessible Close Button

**Current Code (lines 83-88):**
```tsx
<button
  onClick={onClose}
  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
>
  <X className="w-5 h-5 text-gray-500" />
</button>
```

**Updated Code:**
```tsx
<button
  onClick={onClose}
  aria-label="Close task summary modal"
  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
>
  <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
</button>
```

---

### Task 1.3: Add Focus Ring to Format Buttons

**Current Code (lines 122-134):**
```tsx
<button
  key={option.value}
  onClick={() => setSelectedFormat(option.value)}
  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
    selectedFormat === option.value
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`}
>
```

**Updated Code:**
```tsx
<button
  key={option.value}
  onClick={() => setSelectedFormat(option.value)}
  aria-pressed={selectedFormat === option.value}
  aria-label={`Export as ${option.label}`}
  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
    selectedFormat === option.value
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`}
>
```

---

### Task 1.4: Add aria-live Region for Status Messages

**Add after imports (line 12):**
```tsx
// Status announcement for screen readers
const [statusMessage, setStatusMessage] = useState<string | null>(null);
```

**Add inside modal, before closing div (around line 252):**
```tsx
{/* Screen reader status announcements */}
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {statusMessage}
</div>
```

**Update handleCopy function (lines 40-46):**
```tsx
const handleCopy = async () => {
  const success = await copyToClipboard(summaryText);
  if (success) {
    setCopied(true);
    setStatusMessage(`${selectedFormat.toUpperCase()} summary copied to clipboard`);
    setTimeout(() => {
      setCopied(false);
      setStatusMessage(null);
    }, 2000);
  } else {
    setStatusMessage('Failed to copy. Please try again.');
  }
};
```

---

## Phase 2: Keyboard Support

### Task 2.1: Create Focus Trap Hook

**New File:** `src/hooks/useFocusTrap.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface UseFocusTrapOptions {
  onEscape?: () => void;
  autoFocus?: boolean;
}

export function useFocusTrap<T extends HTMLElement>(
  options: UseFocusTrapOptions = {}
) {
  const { onEscape, autoFocus = true } = options;
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Get all focusable elements within container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector)
    );
  }, []);

  useEffect(() => {
    // Store previously focused element
    previousActiveElement.current = document.activeElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      // Handle Escape
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Handle Tab
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift + Tab: Move backwards
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: Move forwards
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Auto-focus first element
    if (autoFocus) {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        // Focus the primary action button (Copy) or first focusable
        const copyButton = containerRef.current?.querySelector('[data-primary-action]');
        if (copyButton instanceof HTMLElement) {
          copyButton.focus();
        } else {
          focusable[0].focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus on unmount
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [getFocusableElements, onEscape, autoFocus]);

  return containerRef;
}
```

---

### Task 2.2: Create Keyboard Shortcuts Hook

**New File:** `src/hooks/useKeyboardShortcuts.ts`

```typescript
import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.metaKey ? event.metaKey : !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;

        // Support both Ctrl and Cmd (for cross-platform)
        const modifierMatch =
          (shortcut.ctrlKey || shortcut.metaKey)
            ? (event.ctrlKey || event.metaKey)
            : true;

        if (keyMatch && modifierMatch && shiftMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

---

### Task 2.3: Integrate Hooks into Component

**Update imports in TaskCompletionSummary.tsx:**
```tsx
import { useState, useMemo, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
```

**Add inside component, before return:**
```tsx
// Focus trap for modal
const modalRef = useFocusTrap<HTMLDivElement>({
  onEscape: onClose,
  autoFocus: true,
});

// Keyboard shortcuts
useKeyboardShortcuts([
  {
    key: 'c',
    ctrlKey: true,
    action: handleCopy,
    description: 'Copy summary to clipboard',
  },
  {
    key: 'c',
    metaKey: true,
    action: handleCopy,
    description: 'Copy summary to clipboard (Mac)',
  },
], true);
```

**Update modal container to use ref:**
```tsx
<motion.div
  ref={modalRef}
  role="dialog"
  // ... rest of props
>
```

**Add data-primary-action to Copy button (line 232):**
```tsx
<button
  onClick={handleCopy}
  data-primary-action
  className={/* ... */}
>
```

---

## Phase 3: Error Handling & Feedback

### Task 3.1: Enhanced Copy Function with Error States

**Update state declarations:**
```tsx
const [copied, setCopied] = useState(false);
const [copyError, setCopyError] = useState(false);
const [statusMessage, setStatusMessage] = useState<string | null>(null);
```

**Update handleCopy function:**
```tsx
const handleCopy = async () => {
  setCopyError(false);

  try {
    const success = await copyToClipboard(summaryText);

    if (success) {
      setCopied(true);
      setStatusMessage(`${selectedFormat.toUpperCase()} summary copied to clipboard`);

      setTimeout(() => {
        setCopied(false);
        setStatusMessage(null);
      }, 2000);
    } else {
      throw new Error('Clipboard write failed');
    }
  } catch (error) {
    console.error('Copy failed:', error);
    setCopyError(true);
    setStatusMessage('Failed to copy to clipboard. Please try selecting and copying manually.');

    setTimeout(() => {
      setCopyError(false);
      setStatusMessage(null);
    }, 4000);
  }
};
```

---

### Task 3.2: Update Copy Button UI for Error State

**Update Copy button (lines 232-251):**
```tsx
<button
  onClick={handleCopy}
  data-primary-action
  disabled={copied}
  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
    copied
      ? 'bg-green-500 text-white focus:ring-green-500'
      : copyError
      ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500'
      : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
  }`}
>
  {copied ? (
    <>
      <Check className="w-4 h-4" aria-hidden="true" />
      Copied!
    </>
  ) : copyError ? (
    <>
      <AlertCircle className="w-4 h-4" aria-hidden="true" />
      Try Again
    </>
  ) : (
    <>
      <Copy className="w-4 h-4" aria-hidden="true" />
      Copy Summary
      <span className="hidden sm:inline text-xs opacity-70 ml-1">⌘C</span>
    </>
  )}
</button>
```

**Add AlertCircle to imports:**
```tsx
import { X, Copy, Check, FileText, Paperclip, MessageSquare, Code, FileJson, Table, AlertCircle } from 'lucide-react';
```

---

## Phase 4: User Preferences

### Task 4.1: Add Format Preference Storage

**Add utility functions (can add to summaryGenerator.ts or create new file):**

**File:** `src/lib/summaryGenerator.ts` (add at bottom)

```typescript
// User preference storage key
const FORMAT_PREFERENCE_KEY = 'todo_summary_format_preference';

/**
 * Get user's preferred summary format from localStorage
 */
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

/**
 * Save user's preferred summary format to localStorage
 */
export function setPreferredFormat(format: SummaryFormat): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(FORMAT_PREFERENCE_KEY, format);
  } catch (error) {
    console.warn('Failed to save format preference:', error);
  }
}
```

---

### Task 4.2: Integrate Preferences into Component

**Update imports:**
```tsx
import {
  generateSummary,
  copyToClipboard,
  SummaryFormat,
  getPreferredFormat,
  setPreferredFormat,
} from '@/lib/summaryGenerator';
```

**Update state initialization:**
```tsx
const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(() =>
  getPreferredFormat()
);
```

**Add effect to save preference:**
```tsx
// Save format preference when changed
useEffect(() => {
  setPreferredFormat(selectedFormat);
}, [selectedFormat]);
```

---

## Phase 5: Visual Polish

### Task 5.1: Add Visual Indicator for Selected Format (Beyond Color)

**Update format button styling to include border/icon:**
```tsx
{FORMAT_OPTIONS.map((option) => {
  const isSelected = selectedFormat === option.value;
  return (
    <button
      key={option.value}
      onClick={() => setSelectedFormat(option.value)}
      aria-pressed={isSelected}
      aria-label={`Export as ${option.label}`}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
        isSelected
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400 dark:ring-blue-600 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 ring-1 ring-transparent hover:ring-gray-200 dark:hover:ring-gray-600'
      }`}
    >
      <span className={isSelected ? 'text-blue-600 dark:text-blue-400' : ''}>
        {option.icon}
      </span>
      {option.label}
      {isSelected && (
        <Check className="w-3 h-3 ml-0.5" aria-hidden="true" />
      )}
    </button>
  );
})}
```

---

### Task 5.2: Add Keyboard Shortcut Hint

**Update format label section:**
```tsx
<div className="mb-3">
  <div className="flex items-center justify-between mb-2">
    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
      Export Format
    </p>
    <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
      Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">⌘C</kbd> to copy
    </p>
  </div>
  {/* ... format buttons ... */}
</div>
```

---

### Task 5.3: Improve Preview/Raw Toggle Labels

**Update toggle buttons (lines 139-160):**
```tsx
<div className="flex gap-2 mb-3" role="tablist" aria-label="Summary view mode">
  <button
    role="tab"
    aria-selected={showPreview}
    aria-controls="summary-preview-panel"
    onClick={() => setShowPreview(true)}
    className={`px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      showPreview
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    Formatted Preview
  </button>
  <button
    role="tab"
    aria-selected={!showPreview}
    aria-controls="summary-raw-panel"
    onClick={() => setShowPreview(false)}
    className={`px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      !showPreview
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    Copy-Ready Text
  </button>
</div>

{/* Summary Content with tabpanel roles */}
{showPreview ? (
  <div
    id="summary-preview-panel"
    role="tabpanel"
    aria-labelledby="preview-tab"
    className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3"
  >
    {/* ... preview content ... */}
  </div>
) : (
  <pre
    id="summary-raw-panel"
    role="tabpanel"
    aria-labelledby="raw-tab"
    className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto"
  >
    {summaryText}
  </pre>
)}
```

---

## Testing Checklist

### Accessibility Testing
- [ ] Screen reader announces modal title and description when opened
- [ ] Tab key cycles through all interactive elements in logical order
- [ ] Shift+Tab cycles backwards
- [ ] Focus is trapped within modal
- [ ] Escape key closes modal
- [ ] Focus returns to trigger element on close
- [ ] Format button selection state is announced
- [ ] Copy success/failure is announced
- [ ] Color is not the only indicator of selected state

### Keyboard Testing
- [ ] Cmd/Ctrl+C copies summary without clicking
- [ ] Escape closes modal
- [ ] Enter on Copy button triggers copy
- [ ] Tab navigation works through all buttons

### Functional Testing
- [ ] Format preference persists across page refreshes
- [ ] Copy works in all browsers (Chrome, Firefox, Safari, Edge)
- [ ] Copy failure shows error state
- [ ] All four formats generate correct output
- [ ] Preview/Raw toggle shows appropriate content

### Visual Testing
- [ ] Focus rings are visible in both light and dark mode
- [ ] Selected format is clearly distinguishable
- [ ] Error state is clearly visible
- [ ] Keyboard shortcut hint is visible on desktop

---

## Complete File: TaskCompletionSummary.tsx (After All Changes)

```tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, FileText, Paperclip, MessageSquare, Code, FileJson, Table, AlertCircle } from 'lucide-react';
import { Todo } from '@/types/todo';
import {
  generateSummary,
  copyToClipboard,
  SummaryFormat,
  getPreferredFormat,
  setPreferredFormat,
} from '@/lib/summaryGenerator';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface TaskCompletionSummaryProps {
  todo: Todo;
  completedBy: string;
  onClose: () => void;
}

const FORMAT_OPTIONS: { value: SummaryFormat; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Plain Text', icon: <FileText className="w-4 h-4" /> },
  { value: 'markdown', label: 'Markdown', icon: <Code className="w-4 h-4" /> },
  { value: 'json', label: 'JSON', icon: <FileJson className="w-4 h-4" /> },
  { value: 'csv', label: 'CSV', icon: <Table className="w-4 h-4" /> },
];

export function TaskCompletionSummary({
  todo,
  completedBy,
  onClose,
}: TaskCompletionSummaryProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(() =>
    getPreferredFormat()
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Save format preference when changed
  useEffect(() => {
    setPreferredFormat(selectedFormat);
  }, [selectedFormat]);

  const summaryText = useMemo(
    () => generateSummary(todo, completedBy, selectedFormat),
    [todo, completedBy, selectedFormat]
  );

  const handleCopy = async () => {
    setCopyError(false);

    try {
      const success = await copyToClipboard(summaryText);

      if (success) {
        setCopied(true);
        setStatusMessage(`${selectedFormat.toUpperCase()} summary copied to clipboard`);

        setTimeout(() => {
          setCopied(false);
          setStatusMessage(null);
        }, 2000);
      } else {
        throw new Error('Clipboard write failed');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyError(true);
      setStatusMessage('Failed to copy to clipboard. Please try selecting and copying manually.');

      setTimeout(() => {
        setCopyError(false);
        setStatusMessage(null);
      }, 4000);
    }
  };

  // Focus trap for modal
  const modalRef = useFocusTrap<HTMLDivElement>({
    onEscape: onClose,
    autoFocus: true,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'c',
      ctrlKey: true,
      action: handleCopy,
      description: 'Copy summary to clipboard',
    },
    {
      key: 'c',
      metaKey: true,
      action: handleCopy,
      description: 'Copy summary to clipboard (Mac)',
    },
  ], true);

  const subtasksCompleted = todo.subtasks?.filter(s => s.completed).length || 0;
  const subtasksTotal = todo.subtasks?.length || 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-modal-title"
          aria-describedby="summary-modal-description"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="summary-modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Task Summary
                </h2>
                <p
                  id="summary-modal-description"
                  className="text-sm text-gray-500 dark:text-gray-400"
                >
                  Copy to paste into your database
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close task summary modal"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
            {/* Quick Stats */}
            <div className="flex gap-4 mb-4">
              {subtasksTotal > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
                  <span>{subtasksCompleted}/{subtasksTotal} subtasks</span>
                </div>
              )}
              {todo.attachments && todo.attachments.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Paperclip className="w-4 h-4" aria-hidden="true" />
                  <span>{todo.attachments.length} attachments</span>
                </div>
              )}
              {todo.transcription && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  <span>Transcription</span>
                </div>
              )}
            </div>

            {/* Format Selector */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Export Format
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">⌘C</kbd> to copy
                </p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Export format options">
                {FORMAT_OPTIONS.map((option) => {
                  const isSelected = selectedFormat === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedFormat(option.value)}
                      aria-pressed={isSelected}
                      aria-label={`Export as ${option.label}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400 dark:ring-blue-600 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className={isSelected ? 'text-blue-600 dark:text-blue-400' : ''}>
                        {option.icon}
                      </span>
                      {option.label}
                      {isSelected && (
                        <Check className="w-3 h-3 ml-0.5" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Preview/Raw */}
            <div className="flex gap-2 mb-3" role="tablist" aria-label="Summary view mode">
              <button
                role="tab"
                aria-selected={showPreview}
                aria-controls="summary-preview-panel"
                onClick={() => setShowPreview(true)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  showPreview
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Formatted Preview
              </button>
              <button
                role="tab"
                aria-selected={!showPreview}
                aria-controls="summary-raw-panel"
                onClick={() => setShowPreview(false)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !showPreview
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Copy-Ready Text
              </button>
            </div>

            {/* Summary Content */}
            {showPreview ? (
              <div
                id="summary-preview-panel"
                role="tabpanel"
                className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3"
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {todo.text}
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Completed by {completedBy}</p>
                  <p>Priority: <span className="capitalize">{todo.priority}</span></p>
                  {todo.assigned_to && <p>Assigned to: {todo.assigned_to}</p>}
                </div>

                {subtasksTotal > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      SUBTASKS
                    </p>
                    <ul className="space-y-1">
                      {todo.subtasks?.map((subtask) => (
                        <li
                          key={subtask.id}
                          className={`text-sm flex items-center gap-2 ${
                            subtask.completed
                              ? 'text-gray-500 dark:text-gray-400'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className={subtask.completed ? 'text-green-500' : 'text-gray-400'}>
                            {subtask.completed ? '✓' : '○'}
                          </span>
                          <span className={subtask.completed ? 'line-through' : ''}>
                            {subtask.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {todo.notes && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      NOTES
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {todo.notes}
                    </p>
                  </div>
                )}

                <div className="pt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                  Generated by Bealer Agency Todo App
                </div>
              </div>
            ) : (
              <pre
                id="summary-raw-panel"
                role="tabpanel"
                className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto"
              >
                {summaryText}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              data-primary-action
              disabled={copied}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                copied
                  ? 'bg-green-500 text-white focus:ring-green-500'
                  : copyError
                  ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Copied!
                </>
              ) : copyError ? (
                <>
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  Try Again
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  Copy Summary
                  <span className="hidden sm:inline text-xs opacity-70 ml-1">⌘C</span>
                </>
              )}
            </button>
          </div>

          {/* Screen reader status announcements */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {statusMessage}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## Implementation Order for Tech Lead

1. **Create hook files first** (no dependencies):
   - `src/hooks/useFocusTrap.ts`
   - `src/hooks/useKeyboardShortcuts.ts`

2. **Update summaryGenerator.ts** (add preference functions)

3. **Update TaskCompletionSummary.tsx** (apply all changes)

4. **Test all checklist items**

5. **Consider adding to existing test suite** (`tests/`)

---

## Notes for Tech Lead

- All changes are backward compatible
- No database changes required
- No API changes required
- All changes are in the frontend React layer
- Hooks can be reused for other modals in the app
- Format preference uses localStorage (no auth required)
- Focus trap pattern should be applied to other modals (CustomerEmailModal, SmartParseModal, etc.)

---

**Document Prepared By:** UX Engineer
**Ready for:** Tech Lead Review & Implementation
**Next Steps:** Tech Lead assigns tasks to frontend developers
