/**
 * useKeyboardShortcuts Hook
 *
 * Registers global keyboard shortcuts with modifier key support.
 * Cross-platform compatible (Ctrl for Windows/Linux, Cmd for Mac).
 *
 * Features:
 * - Automatic platform detection for Ctrl/Cmd
 * - Prevents default browser behavior for registered shortcuts
 * - Can be disabled/enabled dynamically
 * - Supports multiple modifier keys
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcut {
  /** The key to listen for (e.g., 'c', 'Enter', 'Escape') */
  key: string;
  /** Require Ctrl key (Windows/Linux) - also matches Cmd on Mac */
  ctrlKey?: boolean;
  /** Require Meta/Cmd key (Mac) - also matches Ctrl on Windows/Linux */
  metaKey?: boolean;
  /** Require Shift key */
  shiftKey?: boolean;
  /** Require Alt/Option key */
  altKey?: boolean;
  /** Action to execute when shortcut is triggered */
  action: () => void;
  /** Human-readable description of the shortcut */
  description: string;
  /** Prevent default browser behavior (default: true) */
  preventDefault?: boolean;
}

/**
 * Options for the useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
  /** Whether to allow shortcuts when an input element is focused (default: false) */
  allowInInputs?: boolean;
  /** Whether to stop propagation after handling (default: true) */
  stopPropagation?: boolean;
}

/**
 * Platform detection for cross-platform modifier key support
 */
const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

/**
 * Check if the event matches a shortcut configuration
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Check the key (case-insensitive for letters)
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  if (eventKey !== shortcutKey) {
    return false;
  }

  // Cross-platform modifier handling
  // If ctrlKey is specified, match either Ctrl (Windows/Linux) or Cmd (Mac)
  // If metaKey is specified, match either Cmd (Mac) or Ctrl (Windows/Linux)
  const requiresModifier = shortcut.ctrlKey || shortcut.metaKey;

  if (requiresModifier) {
    const hasModifier = isMac ? event.metaKey : event.ctrlKey;
    if (!hasModifier) {
      return false;
    }
  } else {
    // If no modifier required, make sure none are pressed (except shift if specified)
    if (event.ctrlKey || event.metaKey) {
      return false;
    }
  }

  // Check shift key
  if (shortcut.shiftKey && !event.shiftKey) {
    return false;
  }
  if (!shortcut.shiftKey && event.shiftKey && shortcut.key.length === 1) {
    // For single character keys, don't match if shift is pressed unexpectedly
    return false;
  }

  // Check alt key
  if (shortcut.altKey && !event.altKey) {
    return false;
  }
  if (!shortcut.altKey && event.altKey) {
    return false;
  }

  return true;
}

/**
 * Get the display string for a keyboard shortcut
 */
export function getShortcutDisplayString(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format the key
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  parts.push(key);

  return parts.join(isMac ? '' : '+');
}

/**
 * Hook to register global keyboard shortcuts
 *
 * @param shortcuts - Array of keyboard shortcuts to register
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function MyComponent({ onCopy, onClose }) {
 *   useKeyboardShortcuts([
 *     {
 *       key: 'c',
 *       ctrlKey: true,
 *       action: onCopy,
 *       description: 'Copy to clipboard'
 *     },
 *     {
 *       key: 'Escape',
 *       action: onClose,
 *       description: 'Close modal'
 *     }
 *   ]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, allowInInputs = false, stopPropagation = true } = options;

  // Store shortcuts in a ref to avoid stale closures while preventing unnecessary effect reruns
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if focus is on an input element and we shouldn't handle inputs
      if (!allowInInputs) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const isInput =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable;

        if (isInput) {
          return;
        }
      }

      // Check each shortcut
      for (const shortcut of shortcutsRef.current) {
        if (matchesShortcut(event, shortcut)) {
          // Prevent default unless explicitly disabled
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }

          // Stop propagation if enabled
          if (stopPropagation) {
            event.stopPropagation();
          }

          // Execute the action
          shortcut.action();
          return;
        }
      }
    },
    [enabled, allowInInputs, stopPropagation]
  );

  useEffect(() => {
    if (!enabled) return;

    // Use capture phase to handle shortcuts before other handlers
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Get the platform-appropriate modifier key symbol
 */
export function getModifierSymbol(): string {
  return isMac ? '⌘' : 'Ctrl+';
}

/**
 * Check if we're on Mac platform
 */
export function getIsMac(): boolean {
  return isMac;
}

export default useKeyboardShortcuts;
