'use client';

import {
  useState,
  useRef,
  useEffect,
  useId,
  forwardRef,
  cloneElement,
  isValidElement,
  ReactNode,
  ReactElement,
  HTMLAttributes,
  useCallback,
  RefCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { prefersReducedMotion, DURATION } from '@/lib/animations';

/**
 * Tooltip position options
 */
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Tooltip alignment within position
 */
export type TooltipAlign = 'start' | 'center' | 'end';

/**
 * Tooltip Props
 */
export interface TooltipProps {
  /** Content to display in the tooltip */
  content: ReactNode;
  /** Position of the tooltip relative to the trigger */
  position?: TooltipPosition;
  /** Alignment of the tooltip within its position */
  align?: TooltipAlign;
  /** Delay before showing tooltip (in ms) */
  delay?: number;
  /** Delay before hiding tooltip (in ms) */
  hideDelay?: number;
  /** Whether the tooltip is disabled */
  disabled?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes (for controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** The trigger element */
  children: ReactElement;
  /** Maximum width of the tooltip */
  maxWidth?: number;
  /** Additional className for the tooltip content */
  className?: string;
  /** Whether to render tooltip in a portal */
  portal?: boolean;
  /** Offset from the trigger element (in px) */
  offset?: number;
  /** Whether to show an arrow */
  arrow?: boolean;
  /** ARIA label for accessibility (uses content if string) */
  ariaLabel?: string;
}

// Animation variants by position
const positionAnimations: Record<TooltipPosition, {
  initial: { opacity: number; x: number; y: number; scale: number };
  animate: { opacity: number; x: number; y: number; scale: number };
  exit: { opacity: number; x: number; y: number; scale: number };
}> = {
  top: {
    initial: { opacity: 0, x: 0, y: 4, scale: 0.96 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: 0, y: 4, scale: 0.96 },
  },
  bottom: {
    initial: { opacity: 0, x: 0, y: -4, scale: 0.96 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: 0, y: -4, scale: 0.96 },
  },
  left: {
    initial: { opacity: 0, x: 4, y: 0, scale: 0.96 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: 4, y: 0, scale: 0.96 },
  },
  right: {
    initial: { opacity: 0, x: -4, y: 0, scale: 0.96 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: -4, y: 0, scale: 0.96 },
  },
};

// Arrow rotation by position
const arrowRotation: Record<TooltipPosition, string> = {
  top: 'rotate-180',
  bottom: 'rotate-0',
  left: 'rotate-90',
  right: '-rotate-90',
};

// Arrow position styles by tooltip position
const arrowPositionStyles: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 -mt-[1px]',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-[1px]',
  left: 'left-full top-1/2 -translate-y-1/2 -ml-[1px]',
  right: 'right-full top-1/2 -translate-y-1/2 -mr-[1px]',
};

/**
 * Calculate tooltip position based on trigger element
 */
function calculatePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  position: TooltipPosition,
  align: TooltipAlign,
  offset: number
): { top: number; left: number } {
  let top = 0;
  let left = 0;

  // Base positioning
  switch (position) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - offset;
      break;
    case 'bottom':
      top = triggerRect.bottom + offset;
      break;
    case 'left':
      left = triggerRect.left - tooltipRect.width - offset;
      break;
    case 'right':
      left = triggerRect.right + offset;
      break;
  }

  // Alignment for top/bottom positions
  if (position === 'top' || position === 'bottom') {
    switch (align) {
      case 'start':
        left = triggerRect.left;
        break;
      case 'center':
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'end':
        left = triggerRect.right - tooltipRect.width;
        break;
    }
  }

  // Alignment for left/right positions
  if (position === 'left' || position === 'right') {
    switch (align) {
      case 'start':
        top = triggerRect.top;
        break;
      case 'center':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        break;
      case 'end':
        top = triggerRect.bottom - tooltipRect.height;
        break;
    }
  }

  // Viewport boundary adjustments
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 8;

  // Horizontal bounds
  if (left < padding) {
    left = padding;
  } else if (left + tooltipRect.width > viewportWidth - padding) {
    left = viewportWidth - tooltipRect.width - padding;
  }

  // Vertical bounds
  if (top < padding) {
    top = padding;
  } else if (top + tooltipRect.height > viewportHeight - padding) {
    top = viewportHeight - tooltipRect.height - padding;
  }

  return { top, left };
}

/**
 * Tooltip Component
 *
 * A flexible, accessible tooltip component with smooth Framer Motion animations.
 * Supports multiple positions, configurable delays, and both controlled/uncontrolled modes.
 *
 * Features:
 * - Multiple positions (top, bottom, left, right)
 * - Configurable show/hide delays
 * - Controlled and uncontrolled modes
 * - Portal rendering option
 * - Arrow indicator
 * - Full accessibility support (ARIA)
 * - Smooth entrance/exit animations
 *
 * @example
 * // Basic usage
 * <Tooltip content="Delete this item">
 *   <button>Delete</button>
 * </Tooltip>
 *
 * @example
 * // With custom position and delay
 * <Tooltip content="More info" position="right" delay={500}>
 *   <InfoIcon />
 * </Tooltip>
 *
 * @example
 * // Controlled mode
 * const [open, setOpen] = useState(false);
 * <Tooltip content="Controlled tooltip" open={open} onOpenChange={setOpen}>
 *   <button>Hover me</button>
 * </Tooltip>
 */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      content,
      position = 'top',
      align = 'center',
      delay = 300,
      hideDelay = 0,
      disabled = false,
      open: controlledOpen,
      onOpenChange,
      children,
      maxWidth = 250,
      className = '',
      portal = true,
      offset = 8,
      arrow = true,
      ariaLabel,
    },
    ref
  ) => {
    const tooltipId = useId();
    const [internalOpen, setInternalOpen] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [mounted, setMounted] = useState(false);

    const triggerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Determine if controlled or uncontrolled
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;

    // Handle mount state for portal
    useEffect(() => {
      setMounted(true);
      return () => setMounted(false);
    }, []);

    // Clear timeouts on unmount
    useEffect(() => {
      return () => {
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      };
    }, []);

    // Update tooltip position when open
    useEffect(() => {
      if (!isOpen || !triggerRef.current || !tooltipRef.current) return;

      const updatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const newPosition = calculatePosition(triggerRect, tooltipRect, position, align, offset);
        setTooltipStyle(newPosition);
      };

      // Initial position
      updatePosition();

      // Update on scroll/resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }, [isOpen, position, align, offset]);

    const handleOpen = useCallback(() => {
      if (disabled) return;

      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // Set show timeout
      showTimeoutRef.current = setTimeout(() => {
        if (isControlled) {
          onOpenChange?.(true);
        } else {
          setInternalOpen(true);
        }
      }, delay);
    }, [disabled, delay, isControlled, onOpenChange]);

    const handleClose = useCallback(() => {
      // Clear any pending show timeout
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }

      // Set hide timeout
      hideTimeoutRef.current = setTimeout(() => {
        if (isControlled) {
          onOpenChange?.(false);
        } else {
          setInternalOpen(false);
        }
      }, hideDelay);
    }, [hideDelay, isControlled, onOpenChange]);

    // Don't render if disabled or no content
    if (disabled || !content) {
      return children;
    }

    // Get accessible label
    const accessibleLabel = ariaLabel || (typeof content === 'string' ? content : undefined);

    // Ref callback to merge our ref with child's ref
    const mergeRefs = useCallback((node: HTMLElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
      // Handle existing child ref if any
      const childRef = (children as ReactElement & { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof childRef === 'function') {
        childRef(node);
      } else if (childRef && typeof childRef === 'object') {
        (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    }, [children]);

    // Get child props safely
    const childProps = isValidElement(children)
      ? (children as ReactElement<HTMLAttributes<HTMLElement>>).props
      : {};

    // Clone child element with refs and event handlers
    const trigger = isValidElement(children)
      ? cloneElement(children as ReactElement<HTMLAttributes<HTMLElement> & { ref?: RefCallback<HTMLElement> }>, {
          ref: mergeRefs,
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            handleOpen();
            childProps.onMouseEnter?.(e);
          },
          onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
            handleClose();
            childProps.onMouseLeave?.(e);
          },
          onFocus: (e: React.FocusEvent<HTMLElement>) => {
            handleOpen();
            childProps.onFocus?.(e);
          },
          onBlur: (e: React.FocusEvent<HTMLElement>) => {
            handleClose();
            childProps.onBlur?.(e);
          },
          'aria-describedby': isOpen ? tooltipId : undefined,
        } as Partial<HTMLAttributes<HTMLElement> & { ref: RefCallback<HTMLElement> }>)
      : children;

    const animation = positionAnimations[position];
    const reducedMotion = prefersReducedMotion();

    const tooltipContent = (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={(node) => {
              (tooltipRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            id={tooltipId}
            role="tooltip"
            aria-label={accessibleLabel}
            initial={reducedMotion ? { opacity: 0 } : animation.initial}
            animate={reducedMotion ? { opacity: 1 } : animation.animate}
            exit={reducedMotion ? { opacity: 0 } : animation.exit}
            transition={{ duration: reducedMotion ? 0 : DURATION.fast, ease: [0.4, 0, 0.2, 1] }}
            className={`
              fixed z-[100] pointer-events-none
              px-3 py-2
              bg-[var(--foreground)] text-[var(--background)]
              text-xs font-medium
              rounded-lg shadow-lg
              ${className}
            `}
            style={{
              top: tooltipStyle.top,
              left: tooltipStyle.left,
              maxWidth,
            }}
          >
            {content}

            {/* Arrow */}
            {arrow && (
              <span
                className={`
                  absolute
                  w-0 h-0
                  border-[6px] border-transparent
                  border-t-[var(--foreground)]
                  ${arrowRotation[position]}
                  ${arrowPositionStyles[position]}
                `}
                aria-hidden="true"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <>
        {trigger}
        {mounted && portal
          ? createPortal(tooltipContent, document.body)
          : tooltipContent
        }
      </>
    );
  }
);

Tooltip.displayName = 'Tooltip';

/**
 * Simple tooltip wrapper for elements that just need basic tooltips
 */
export interface SimpleTooltipProps {
  /** Tooltip text */
  text: string;
  /** Position of the tooltip */
  position?: TooltipPosition;
  /** The element to wrap */
  children: ReactElement;
  /** Additional className */
  className?: string;
}

/**
 * SimpleTooltip - A simplified tooltip for basic use cases
 *
 * @example
 * <SimpleTooltip text="Click to save">
 *   <button>Save</button>
 * </SimpleTooltip>
 */
export function SimpleTooltip({
  text,
  position = 'top',
  children,
  className = '',
}: SimpleTooltipProps) {
  return (
    <Tooltip content={text} position={position} className={className}>
      {children}
    </Tooltip>
  );
}

/**
 * Tooltip trigger wrapper for custom tooltip triggers
 */
export interface TooltipTriggerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Wrapped children */
  children: ReactNode;
}

/**
 * TooltipTrigger - Wrapper component for custom tooltip triggers
 *
 * Use this when you need to wrap multiple elements or non-element content
 * as a tooltip trigger.
 *
 * @example
 * <Tooltip content="Information about these items">
 *   <TooltipTrigger>
 *     <span>Item 1</span>
 *     <span>Item 2</span>
 *   </TooltipTrigger>
 * </Tooltip>
 */
export const TooltipTrigger = forwardRef<HTMLSpanElement, TooltipTriggerProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex ${className}`}
        tabIndex={0}
        {...props}
      >
        {children}
      </span>
    );
  }
);

TooltipTrigger.displayName = 'TooltipTrigger';

export default Tooltip;
