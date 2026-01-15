/**
 * useFocusTrap Hook
 *
 * Traps keyboard focus within a container (modal/dialog), handles Escape key,
 * and manages focus restoration when the container unmounts.
 *
 * WCAG 2.1 AA compliant focus management for modal dialogs.
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Selector for all focusable elements within a container
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface UseFocusTrapOptions {
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Whether to auto-focus the first element on mount (default: true) */
  autoFocus?: boolean;
  /** Whether the focus trap is currently enabled (default: true) */
  enabled?: boolean;
  /** Selector for the primary action element to focus first */
  primaryActionSelector?: string;
}

export interface UseFocusTrapReturn<T extends HTMLElement> {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<T | null>;
  /** Manually focus the first focusable element */
  focusFirst: () => void;
  /** Manually focus the last focusable element */
  focusLast: () => void;
}

/**
 * Hook that traps focus within a container element
 *
 * @param options - Configuration options
 * @returns Object with containerRef and focus helper functions
 *
 * @example
 * ```tsx
 * function Modal({ onClose }) {
 *   const { containerRef } = useFocusTrap<HTMLDivElement>({
 *     onEscape: onClose,
 *     primaryActionSelector: '[data-primary-action]'
 *   });
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <button onClick={onClose}>Close</button>
 *       <button data-primary-action onClick={handleSubmit}>Submit</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
): UseFocusTrapReturn<T> {
  const {
    onEscape,
    autoFocus = true,
    enabled = true,
    primaryActionSelector = '[data-primary-action]',
  } = options;

  const containerRef = useRef<T>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  /**
   * Get all focusable elements within the container
   */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    return Array.from(elements).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute('aria-hidden')
    );
  }, []);

  /**
   * Focus the first focusable element
   */
  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }
  }, [getFocusableElements]);

  /**
   * Focus the last focusable element
   */
  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
    }
  }, [getFocusableElements]);

  /**
   * Focus the primary action element or first focusable element
   */
  const focusPrimaryOrFirst = useCallback(() => {
    if (!containerRef.current) return;

    // Try to find and focus the primary action element
    const primaryElement = containerRef.current.querySelector<HTMLElement>(primaryActionSelector);
    if (primaryElement && !primaryElement.hasAttribute('disabled')) {
      primaryElement.focus();
      return;
    }

    // Fall back to first focusable element
    focusFirst();
  }, [primaryActionSelector, focusFirst]);

  /**
   * Handle keydown events for focus trapping and escape
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || !containerRef.current) return;

      // Handle Escape key
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscape?.();
        return;
      }

      // Handle Tab key for focus trapping
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement as HTMLElement;

        // Shift+Tab from first element -> focus last element
        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        // Tab from last element -> focus first element
        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
          return;
        }

        // If focus is outside the container, bring it back
        if (!containerRef.current.contains(activeElement)) {
          event.preventDefault();
          if (event.shiftKey) {
            lastElement.focus();
          } else {
            firstElement.focus();
          }
        }
      }
    },
    [enabled, onEscape, getFocusableElements]
  );

  // Store previous active element on mount (only once)
  useEffect(() => {
    if (!enabled) return;

    // Store the currently focused element to restore later
    previousActiveElementRef.current = document.activeElement as HTMLElement;
  }, [enabled]);

  // Auto-focus primary action or first element
  useEffect(() => {
    if (!enabled || !autoFocus) return;

    // Use requestAnimationFrame to ensure the DOM is ready
    const rafId = requestAnimationFrame(() => {
      focusPrimaryOrFirst();
    });

    return () => cancelAnimationFrame(rafId);
  }, [enabled, autoFocus, focusPrimaryOrFirst]);

  // Set up keyboard event listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);

  // Restore focus on unmount
  useEffect(() => {
    // Capture the ref value at effect creation time for cleanup
    const elementToRestore = previousActiveElementRef.current;

    return () => {
      // Restore focus to the previously focused element
      if (elementToRestore && typeof elementToRestore.focus === 'function') {
        // Use requestAnimationFrame for proper timing without memory leak
        requestAnimationFrame(() => {
          try {
            // Check if element is still in the DOM
            if (document.body.contains(elementToRestore)) {
              elementToRestore.focus();
            }
          } catch {
            // Element may no longer exist or be focusable
          }
        });
      }
    };
  }, []);

  return {
    containerRef,
    focusFirst,
    focusLast,
  };
}

export default useFocusTrap;
