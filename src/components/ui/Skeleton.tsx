'use client';

import { forwardRef, HTMLAttributes, CSSProperties, ReactNode } from 'react';

// ============================================================================
// Base Skeleton Component
// ============================================================================

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Skeleton shape variant */
  variant?: 'text' | 'circle' | 'rectangle' | 'card';
  /** Width (CSS value) */
  width?: string | number;
  /** Height (CSS value) */
  height?: string | number;
  /** Border radius (CSS value) */
  borderRadius?: string | number;
  /** Disable animation (also respects prefers-reduced-motion automatically) */
  animate?: boolean;
}

/**
 * Base Skeleton Component
 *
 * A loading placeholder that uses the .skeleton CSS class from globals.css.
 * Automatically respects prefers-reduced-motion for accessibility.
 *
 * Features:
 * - Multiple shape variants (text, circle, rectangle, card)
 * - Configurable dimensions and border radius
 * - Animation toggle (respects system preferences)
 * - Composable for custom layouts
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = 'rectangle',
      width,
      height,
      borderRadius,
      animate = true,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    // Default dimensions based on variant
    const getDefaultStyles = (): CSSProperties => {
      switch (variant) {
        case 'text':
          return {
            width: width ?? '100%',
            height: height ?? '1em',
            borderRadius: borderRadius ?? 'var(--radius-sm)',
          };
        case 'circle':
          const size = width ?? height ?? 40;
          return {
            width: size,
            height: size,
            borderRadius: '50%',
          };
        case 'card':
          return {
            width: width ?? '100%',
            height: height ?? 120,
            borderRadius: borderRadius ?? 'var(--radius-lg)',
          };
        case 'rectangle':
        default:
          return {
            width: width ?? '100%',
            height: height ?? 20,
            borderRadius: borderRadius ?? 'var(--radius-md)',
          };
      }
    };

    const defaultStyles = getDefaultStyles();

    return (
      <div
        ref={ref}
        className={`
          skeleton
          ${!animate ? '[animation:none] bg-[var(--surface-2)]' : ''}
          ${className}
        `}
        style={{
          ...defaultStyles,
          ...style,
        }}
        aria-hidden="true"
        role="presentation"
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// ============================================================================
// SkeletonText - For text lines
// ============================================================================

export interface SkeletonTextProps extends Omit<SkeletonProps, 'variant'> {
  /** Number of lines to render */
  lines?: number;
  /** Gap between lines */
  gap?: string | number;
  /** Make last line shorter (common text pattern) */
  lastLineWidth?: string | number;
}

/**
 * SkeletonText - Multiple text line placeholders
 *
 * Renders multiple skeleton lines to simulate text content.
 * Commonly used for paragraphs and multi-line text areas.
 */
export function SkeletonText({
  lines = 3,
  gap = 8,
  lastLineWidth = '60%',
  width = '100%',
  height = '0.875em',
  animate = true,
  className = '',
  style,
  ...props
}: SkeletonTextProps) {
  return (
    <div
      className={`flex flex-col ${className}`}
      style={{ gap: typeof gap === 'number' ? `${gap}px` : gap, ...style }}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 && lines > 1 ? lastLineWidth : width}
          height={height}
          animate={animate}
          {...props}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SkeletonAvatar - Circular avatar placeholder
// ============================================================================

export interface SkeletonAvatarProps extends Omit<SkeletonProps, 'variant'> {
  /** Avatar size preset or custom number */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
}

const avatarSizes = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

/**
 * SkeletonAvatar - Circular avatar placeholder
 *
 * Perfect for user profiles, icons, or any circular content.
 */
export function SkeletonAvatar({
  size = 'md',
  animate = true,
  className = '',
  ...props
}: SkeletonAvatarProps) {
  const dimension = typeof size === 'number' ? size : avatarSizes[size];

  return (
    <Skeleton
      variant="circle"
      width={dimension}
      height={dimension}
      animate={animate}
      className={className}
      {...props}
    />
  );
}

// ============================================================================
// SkeletonButton - Button placeholder
// ============================================================================

export interface SkeletonButtonProps extends Omit<SkeletonProps, 'variant'> {
  /** Button size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Full width button */
  fullWidth?: boolean;
}

const buttonSizes = {
  sm: { width: 80, height: 36 },
  md: { width: 120, height: 44 },
  lg: { width: 160, height: 52 },
};

/**
 * SkeletonButton - Button placeholder
 *
 * Matches the Button component dimensions for consistent loading states.
 */
export function SkeletonButton({
  size = 'md',
  fullWidth = false,
  animate = true,
  className = '',
  ...props
}: SkeletonButtonProps) {
  const dimensions = buttonSizes[size];

  return (
    <Skeleton
      variant="rectangle"
      width={fullWidth ? '100%' : dimensions.width}
      height={dimensions.height}
      borderRadius="var(--radius-lg)"
      animate={animate}
      className={className}
      {...props}
    />
  );
}

// ============================================================================
// SkeletonCard - Card with optional header, content, footer
// ============================================================================

export interface SkeletonCardProps extends Omit<SkeletonProps, 'variant' | 'children'> {
  /** Show header section */
  showHeader?: boolean;
  /** Show avatar in header */
  showAvatar?: boolean;
  /** Number of content lines */
  contentLines?: number;
  /** Show footer section */
  showFooter?: boolean;
  /** Custom header content */
  header?: ReactNode;
  /** Custom footer content */
  footer?: ReactNode;
}

/**
 * SkeletonCard - Card placeholder with sections
 *
 * A flexible card skeleton with optional header, content, and footer sections.
 * Great for loading states of card-based UIs.
 */
export function SkeletonCard({
  showHeader = true,
  showAvatar = true,
  contentLines = 3,
  showFooter = false,
  header,
  footer,
  animate = true,
  className = '',
  ...props
}: SkeletonCardProps) {
  return (
    <div
      className={`
        bg-[var(--surface)] border border-[var(--border-subtle)]
        rounded-[var(--radius-lg)] p-4
        ${className}
      `}
      {...props}
    >
      {/* Header */}
      {showHeader && (
        header ?? (
          <div className="flex items-center gap-3 mb-4">
            {showAvatar && <SkeletonAvatar size="md" animate={animate} />}
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="40%" height="1rem" animate={animate} />
              <Skeleton variant="text" width="20%" height="0.75rem" animate={animate} />
            </div>
          </div>
        )
      )}

      {/* Content */}
      {contentLines > 0 && (
        <div className={showHeader ? 'mt-3' : ''}>
          <SkeletonText lines={contentLines} animate={animate} />
        </div>
      )}

      {/* Footer */}
      {showFooter && (
        footer ?? (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)]">
            <SkeletonButton size="sm" animate={animate} />
            <SkeletonButton size="sm" animate={animate} />
          </div>
        )
      )}
    </div>
  );
}

// ============================================================================
// SkeletonTodoItem - Matches TodoItem layout
// ============================================================================

export interface SkeletonTodoItemProps {
  /** Show subtasks indicator */
  showSubtasks?: boolean;
  /** Number of subtask placeholders */
  subtaskCount?: number;
  /** Show expanded subtasks */
  expanded?: boolean;
  /** Show attachments indicator */
  showAttachments?: boolean;
  /** Show action buttons */
  showActions?: boolean;
  /** Disable animation */
  animate?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * SkeletonTodoItem - TodoItem layout placeholder
 *
 * Matches the exact layout of the TodoItem component for seamless loading states.
 * Includes checkbox, text, priority, assignee, due date, and optional subtasks.
 */
export function SkeletonTodoItem({
  showSubtasks = false,
  subtaskCount = 2,
  expanded = false,
  showAttachments = false,
  showActions = true,
  animate = true,
  className = '',
}: SkeletonTodoItemProps) {
  return (
    <div
      className={`
        bg-[var(--surface)] border border-[var(--border-subtle)]
        rounded-[var(--radius-lg)] p-4
        ${className}
      `}
    >
      {/* Main row */}
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Skeleton
          variant="rectangle"
          width={22}
          height={22}
          borderRadius="var(--radius-sm)"
          animate={animate}
          className="flex-shrink-0 mt-0.5"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Task text */}
          <Skeleton
            variant="text"
            width="80%"
            height="1.125rem"
            animate={animate}
          />

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Priority badge */}
            <Skeleton
              variant="rectangle"
              width={60}
              height={22}
              borderRadius="var(--radius-sm)"
              animate={animate}
            />

            {/* Assignee */}
            <div className="flex items-center gap-1.5">
              <SkeletonAvatar size="sm" animate={animate} />
              <Skeleton variant="text" width={50} height="0.75rem" animate={animate} />
            </div>

            {/* Due date */}
            <Skeleton
              variant="rectangle"
              width={70}
              height={20}
              borderRadius="var(--radius-sm)"
              animate={animate}
            />
          </div>

          {/* Subtasks indicator */}
          {showSubtasks && !expanded && (
            <div className="flex items-center gap-2 mt-2">
              <Skeleton variant="text" width={80} height="0.75rem" animate={animate} />
            </div>
          )}

          {/* Attachments indicator */}
          {showAttachments && (
            <div className="flex items-center gap-2 mt-2">
              <Skeleton variant="rectangle" width={16} height={16} animate={animate} />
              <Skeleton variant="text" width={60} height="0.75rem" animate={animate} />
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Skeleton
              variant="rectangle"
              width={32}
              height={32}
              borderRadius="var(--radius-md)"
              animate={animate}
            />
            <Skeleton
              variant="rectangle"
              width={32}
              height={32}
              borderRadius="var(--radius-md)"
              animate={animate}
            />
          </div>
        )}
      </div>

      {/* Expanded subtasks */}
      {showSubtasks && expanded && subtaskCount > 0 && (
        <div className="mt-3 ml-[34px] space-y-2 pt-3 border-t border-[var(--border-subtle)]">
          {Array.from({ length: subtaskCount }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton
                variant="rectangle"
                width={18}
                height={18}
                borderRadius="var(--radius-sm)"
                animate={animate}
              />
              <Skeleton
                variant="text"
                width={`${70 - index * 10}%`}
                height="0.875rem"
                animate={animate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SkeletonList - Multiple skeleton items
// ============================================================================

export interface SkeletonListProps {
  /** Number of items to render */
  count?: number;
  /** Skeleton item component or element */
  children?: ReactNode;
  /** Use SkeletonTodoItem as default */
  variant?: 'todo' | 'card' | 'custom';
  /** Gap between items */
  gap?: string | number;
  /** Disable animation */
  animate?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * SkeletonList - Multiple skeleton items
 *
 * Renders a list of skeleton placeholders. Useful for loading states
 * of list-based UIs like task lists, feeds, or search results.
 */
export function SkeletonList({
  count = 3,
  children,
  variant = 'todo',
  gap = 12,
  animate = true,
  className = '',
}: SkeletonListProps) {
  const renderItem = (index: number) => {
    if (children) {
      return children;
    }

    switch (variant) {
      case 'card':
        return <SkeletonCard animate={animate} />;
      case 'todo':
      default:
        return <SkeletonTodoItem animate={animate} />;
    }
  };

  return (
    <div
      className={`flex flex-col ${className}`}
      style={{ gap: typeof gap === 'number' ? `${gap}px` : gap }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderItem(index)}</div>
      ))}
    </div>
  );
}

// ============================================================================
// SkeletonInline - For inline content like icons + text
// ============================================================================

export interface SkeletonInlineProps {
  /** Show icon placeholder */
  showIcon?: boolean;
  /** Icon size */
  iconSize?: number;
  /** Text width */
  textWidth?: string | number;
  /** Disable animation */
  animate?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * SkeletonInline - Inline icon + text placeholder
 *
 * Perfect for menu items, list entries, or any inline icon+text patterns.
 */
export function SkeletonInline({
  showIcon = true,
  iconSize = 16,
  textWidth = 80,
  animate = true,
  className = '',
}: SkeletonInlineProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <Skeleton
          variant="rectangle"
          width={iconSize}
          height={iconSize}
          borderRadius="var(--radius-sm)"
          animate={animate}
        />
      )}
      <Skeleton variant="text" width={textWidth} height="0.875rem" animate={animate} />
    </div>
  );
}

export default Skeleton;
