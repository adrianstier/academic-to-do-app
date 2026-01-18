'use client';

import { forwardRef, HTMLAttributes, ReactNode, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'away' | 'busy' | 'offline';

export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Image source URL */
  src?: string | null;
  /** Alt text for the image (also used for initials fallback) */
  alt: string;
  /** Avatar size */
  size?: AvatarSize;
  /** Status indicator */
  status?: AvatarStatus;
  /** Custom background color for initials fallback */
  color?: string;
  /** Add a ring/border highlight */
  ring?: boolean;
  /** Ring color (only used when ring is true) */
  ringColor?: string;
  /** Enable hover effect */
  hoverable?: boolean;
  /** Custom fallback content instead of initials */
  fallback?: ReactNode;
  /** Loading state */
  loading?: boolean;
}

const sizeStyles: Record<AvatarSize, {
  container: string;
  text: string;
  status: string;
  statusOffset: string;
}> = {
  xs: {
    container: 'w-6 h-6',
    text: 'text-[10px]',
    status: 'w-2 h-2',
    statusOffset: '-right-0.5 -bottom-0.5',
  },
  sm: {
    container: 'w-8 h-8',
    text: 'text-xs',
    status: 'w-2.5 h-2.5',
    statusOffset: '-right-0.5 -bottom-0.5',
  },
  md: {
    container: 'w-10 h-10',
    text: 'text-sm',
    status: 'w-3 h-3',
    statusOffset: '-right-0.5 -bottom-0.5',
  },
  lg: {
    container: 'w-12 h-12',
    text: 'text-base',
    status: 'w-3.5 h-3.5',
    statusOffset: '-right-0.5 -bottom-0.5',
  },
  xl: {
    container: 'w-16 h-16',
    text: 'text-lg',
    status: 'w-4 h-4',
    statusOffset: '-right-1 -bottom-1',
  },
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-[var(--success-vivid)]',
  away: 'bg-[var(--warning)]',
  busy: 'bg-[var(--danger)]',
  offline: 'bg-[var(--text-light)]',
};

/**
 * Get initials from a name string
 * @param name - Full name to extract initials from
 * @returns 1-2 character initials
 */
function getInitials(name: string): string {
  if (!name) return '?';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate a consistent color from a string
 * @param str - String to generate color from
 * @returns Hex color string
 */
function stringToColor(str: string): string {
  const colors = [
    '#0033A0', // Brand Blue
    '#72B5E8', // Sky Blue
    '#C9A227', // Gold
    '#003D7A', // Navy
    '#6E8AA7', // Muted Blue
    '#5BA8A0', // Teal
    '#E87722', // Orange
    '#98579B', // Purple
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Avatar Component
 *
 * A flexible avatar component for displaying user profile images or initials.
 * Supports multiple sizes, status indicators, and hover effects.
 *
 * Features:
 * - Image with automatic fallback to initials
 * - Multiple sizes (xs, sm, md, lg, xl)
 * - Status indicator (online, away, busy, offline)
 * - Ring/border highlight option
 * - Hover effect for interactive avatars
 * - Accessible with proper alt text handling
 */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      size = 'md',
      status,
      color,
      ring = false,
      ringColor,
      hoverable = false,
      fallback,
      loading = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const sizeStyle = sizeStyles[size];

    const backgroundColor = useMemo(() => {
      return color || stringToColor(alt);
    }, [color, alt]);

    const initials = useMemo(() => {
      return getInitials(alt);
    }, [alt]);

    const showImage = src && !imageError && !loading;
    const showFallback = !showImage;

    return (
      <div
        ref={ref}
        className={`
          relative inline-flex items-center justify-center
          ${sizeStyle.container}
          rounded-full
          overflow-hidden
          flex-shrink-0
          ${ring ? 'ring-2' : ''}
          ${ring && !ringColor ? 'ring-[var(--accent)]' : ''}
          ${hoverable ? 'cursor-pointer transition-transform duration-150 hover:scale-105' : ''}
          ${className}
        `}
        style={{
          ...(ring && ringColor ? { '--tw-ring-color': ringColor } as React.CSSProperties : {}),
        }}
        role="img"
        aria-label={alt}
        {...props}
      >
        {/* Loading skeleton */}
        {loading && (
          <div className="absolute inset-0 bg-[var(--surface-2)] animate-pulse" />
        )}

        {/* Image */}
        {showImage && (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}

        {/* Fallback (initials or custom) */}
        {showFallback && !loading && (
          <div
            className={`
              w-full h-full
              flex items-center justify-center
              text-white font-semibold
              ${sizeStyle.text}
            `}
            style={{ backgroundColor }}
          >
            {fallback || initials}
          </div>
        )}

        {/* Status indicator */}
        {status && (
          <span
            className={`
              absolute ${sizeStyle.statusOffset}
              ${sizeStyle.status}
              ${statusColors[status]}
              rounded-full
              border-2 border-[var(--surface)]
              ${status === 'online' ? 'status-dot online' : ''}
            `}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

/**
 * AvatarGroup Props
 */
export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Maximum number of avatars to show before truncating */
  max?: number;
  /** Size for all avatars in the group */
  size?: AvatarSize;
  /** Spacing between avatars (negative for overlap) */
  spacing?: 'tight' | 'normal' | 'loose';
  /** Children should be Avatar components */
  children: ReactNode;
}

const spacingStyles: Record<'tight' | 'normal' | 'loose', string> = {
  tight: '-space-x-3',
  normal: '-space-x-2',
  loose: '-space-x-1',
};

/**
 * AvatarGroup Component
 *
 * A component for displaying a stack of avatars with overlap.
 * Uses the avatar-stack CSS class for styling.
 *
 * Features:
 * - Configurable maximum display count
 * - Shows "+N" indicator for overflow
 * - Multiple spacing options
 * - Consistent sizing across all avatars
 */
export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  (
    {
      max = 5,
      size = 'md',
      spacing = 'normal',
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const childArray = Array.isArray(children) ? children : [children];
    const visibleChildren = childArray.slice(0, max);
    const overflowCount = childArray.length - max;

    const sizeStyle = sizeStyles[size];

    return (
      <div
        ref={ref}
        className={`
          avatar-stack
          flex flex-row-reverse
          ${spacingStyles[spacing]}
          ${className}
        `}
        role="group"
        aria-label={`Group of ${childArray.length} avatars`}
        {...props}
      >
        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <div
            className={`
              ${sizeStyle.container}
              flex items-center justify-center
              rounded-full
              bg-[var(--surface-2)]
              text-[var(--foreground)]
              font-medium
              ${sizeStyle.text}
              border-2 border-[var(--surface)]
              z-0
            `}
            aria-label={`${overflowCount} more`}
          >
            +{overflowCount}
          </div>
        )}

        {/* Visible avatars (reversed for proper stacking order) */}
        {visibleChildren.reverse().map((child, index) => (
          <div
            key={index}
            className="border-2 border-[var(--surface)] rounded-full"
            style={{ zIndex: visibleChildren.length - index }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

/**
 * Animated Avatar with hover/tap animations
 */
export interface AnimatedAvatarProps extends AvatarProps {
  /** Animation type */
  animation?: 'scale' | 'bounce' | 'glow';
}

export function AnimatedAvatar({
  animation = 'scale',
  ...props
}: AnimatedAvatarProps) {
  const getAnimationProps = () => {
    switch (animation) {
      case 'scale':
        return {
          whileHover: { scale: 1.1 },
          whileTap: { scale: 0.95 },
        };
      case 'bounce':
        return {
          whileHover: { y: -4 },
          whileTap: { y: 0 },
          transition: { type: 'spring', stiffness: 400 },
        };
      case 'glow':
        return {
          whileHover: { boxShadow: '0 0 20px var(--accent)', scale: 1.05 },
          whileTap: { scale: 0.98 },
        };
      default:
        return {
          whileHover: { scale: 1.1 },
          whileTap: { scale: 0.95 },
        };
    }
  };

  return (
    <motion.div
      {...getAnimationProps()}
      transition={{ duration: 0.15 }}
    >
      <Avatar {...props} />
    </motion.div>
  );
}

/**
 * User Avatar - Convenience wrapper with common user avatar patterns
 */
export interface UserAvatarProps extends Omit<AvatarProps, 'alt'> {
  /** User's name (used for alt text and initials) */
  name: string;
  /** User's profile image URL */
  imageUrl?: string | null;
  /** User's assigned color */
  userColor?: string;
  /** Show online status indicator */
  showStatus?: boolean;
  /** Current status (only shown if showStatus is true) */
  currentStatus?: AvatarStatus;
}

export function UserAvatar({
  name,
  imageUrl,
  userColor,
  showStatus = false,
  currentStatus = 'offline',
  ...props
}: UserAvatarProps) {
  return (
    <Avatar
      src={imageUrl}
      alt={name}
      color={userColor}
      status={showStatus ? currentStatus : undefined}
      {...props}
    />
  );
}

export default Avatar;
