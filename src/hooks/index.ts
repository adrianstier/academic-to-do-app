/**
 * Hooks Index
 *
 * Centralized exports for all custom hooks
 */

export { useTodoData } from './useTodoData';
export { useFilters } from './useFilters';
export { useBulkActions } from './useBulkActions';

// Accessibility & UX Hooks
export { useFocusTrap } from './useFocusTrap';
export type { UseFocusTrapOptions, UseFocusTrapReturn } from './useFocusTrap';

export {
  useKeyboardShortcuts,
  getShortcutDisplayString,
  getModifierSymbol,
  getIsMac,
} from './useKeyboardShortcuts';
export type { KeyboardShortcut, UseKeyboardShortcutsOptions } from './useKeyboardShortcuts';
