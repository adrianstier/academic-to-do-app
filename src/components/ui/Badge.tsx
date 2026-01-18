'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge variant determines color scheme */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Add pulsing animation for attention */
  pulse?: boolean;
  /** Add dot indicator before text */
  dot?: boolean;
  /** Dot color (only used when dot is true) */
  dotColor?: string;
  /** Icon to show before text */
  icon?: ReactNode;
  /** Make badge interactive (hover states) */
  interactive?: boolean;
}

const variantStyles = {
  default: {
    bg: 'bg-[var(--surface-2)]',
    text: 'text-[var(--text-muted)]',
    border: 'border-[var(--border)]',
    dot: 'var(--text-muted)',
  },
  primary: {
    bg: 'bg-[var(--accent-light)]',
    text: 'text-[var(--accent)]',
    border: 'border-[var(--accent)]/20',
    dot: 'var(--accent)',
  },
  success: {
    bg: 'bg-[var(--success-light)]',
    text: 'text-[var(--success)]',
    border: 'border-[var(--success)]/20',
    dot: 'var(--success)',
  },
  warning: {
    bg: 'bg-[var(--warning-light)]',
    text: 'text-[var(--warning)]',
    border: 'border-[var(--warning)]/20',
    dot: 'var(--warning)',
  },
  danger: {
    bg: 'bg-[var(--danger-light)]',
    text: 'text-[var(--danger)]',
    border: 'border-[var(--danger)]/20',
    dot: 'var(--danger)',
  },
  info: {
    bg: 'bg-[var(--accent-sky-light)]',
    text: 'text-[var(--accent-sky)]',
    border: 'border-[var(--accent-sky)]/20',
    dot: 'var(--accent-sky)',
  },
  brand: {
    bg: 'bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-blue-light)]',
    text: 'text-white',
    border: 'border-transparent',
    dot: 'white',
  },
};

const sizeStyles = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    dot: 'w-1.5 h-1.5',
    icon: 'w-3 h-3',
    gap: 'gap-1',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-xs',
    dot: 'w-2 h-2',
    icon: 'w-3.5 h-3.5',
    gap: 'gap-1.5',
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-sm',
    dot: 'w-2.5 h-2.5',
    icon: 'w-4 h-4',
    gap: 'gap-2',
  },
};

/**
 * Badge Component
 *
 * A versatile badge/tag component for status indicators, labels, and counts.
 * Supports multiple variants, sizes, and optional animations.
 *
 * Features:
 * - Multiple color variants for different contexts
 * - Optional pulsing animation for attention-grabbing
 * - Optional status dot indicator
 * - Icon support
 * - Interactive mode with hover states
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      pulse = false,
      dot = false,
      dotColor,
      icon,
      interactive = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center ${sizeStyle.gap}
          ${sizeStyle.padding} ${sizeStyle.text}
          ${variantStyle.bg} ${variantStyle.text}
          border ${variantStyle.border}
          rounded-full font-medium
          transition-all duration-150 ease-out
          ${interactive ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''}
          ${className}
        `}
        {...props}
      >
        {/* Pulsing dot */}
        {dot && (
          <span className="relative flex">
            <span
              className={`${sizeStyle.dot} rounded-full`}
              style={{ backgroundColor: dotColor || variantStyle.dot }}
            />
            {pulse && (
              <span
                className={`absolute ${sizeStyle.dot} rounded-full animate-ping`}
                style={{ backgroundColor: dotColor || variantStyle.dot, opacity: 0.75 }}
              />
            )}
          </span>
        )}

        {/* Icon */}
        {!dot && icon && (
          <span className={`${sizeStyle.icon} flex-shrink-0`}>
            {icon}
          </span>
        )}

        {/* Text content */}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/**
 * Animated Badge with entrance/exit animations
 */
export interface AnimatedBadgeProps extends BadgeProps {
  /** Whether the badge is visible */
  show?: boolean;
}

export function AnimatedBadge({ show = true, ...props }: AnimatedBadgeProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -4 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        >
          <Badge {...props} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * Count Badge for notification counts
 */
export interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'danger',
  size = 'sm',
  className = ''
}: CountBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  const sizeClasses = {
    sm: 'min-w-[18px] h-[18px] text-[10px] px-1',
    md: 'min-w-[22px] h-[22px] text-xs px-1.5',
  };

  const variantClasses = {
    default: 'bg-[var(--surface-3)] text-[var(--foreground)]',
    primary: 'bg-[var(--accent)] text-white',
    danger: 'bg-[var(--danger)] text-white',
  };

  return (
    <motion.span
      key={count}
      initial={{ scale: 1.2 }}
      animate={{ scale: 1 }}
      className={`
        inline-flex items-center justify-center
        ${sizeClasses[size]} ${variantClasses[variant]}
        rounded-full font-semibold
        ${className}
      `}
    >
      {displayCount}
    </motion.span>
  );
}

/**
 * Status Badge with preset configurations
 */
export type StatusType = 'online' | 'away' | 'busy' | 'offline' | 'todo' | 'in_progress' | 'done';

const statusConfig: Record<StatusType, { label: string; variant: BadgeProps['variant']; pulse?: boolean }> = {
  online: { label: 'Online', variant: 'success', pulse: true },
  away: { label: 'Away', variant: 'warning' },
  busy: { label: 'Busy', variant: 'danger' },
  offline: { label: 'Offline', variant: 'default' },
  todo: { label: 'To Do', variant: 'primary' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  done: { label: 'Done', variant: 'success' },
};

export interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = 'md',
  showLabel = true,
  className = ''
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot
      pulse={config.pulse}
      className={className}
    >
      {showLabel && config.label}
    </Badge>
  );
}

export default Badge;
