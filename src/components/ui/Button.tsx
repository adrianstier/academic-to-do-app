'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline' | 'brand' | 'success';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Show loading spinner */
  loading?: boolean;
  /** Icon to show before text */
  leftIcon?: ReactNode;
  /** Icon to show after text */
  rightIcon?: ReactNode;
  /** Make button full width */
  fullWidth?: boolean;
}

const variantClasses = {
  primary: `
    bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-light)]
    text-white font-semibold
    shadow-[var(--shadow-md)]
    hover:opacity-90 hover:shadow-[var(--shadow-lg)]
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50
  `,
  secondary: `
    bg-[var(--surface-2)] text-[var(--foreground)]
    border border-[var(--border)]
    hover:bg-[var(--surface-3)] hover:border-[var(--border-hover)]
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  danger: `
    bg-[var(--danger)] text-white font-semibold
    hover:bg-[#B91C1C]
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  warning: `
    bg-[var(--warning)] text-white font-semibold
    hover:bg-[#B45309]
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  ghost: `
    text-[var(--foreground)]
    hover:bg-[var(--surface-2)]
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  outline: `
    border-2 border-[var(--accent)] text-[var(--accent)]
    hover:bg-[var(--accent-light)]
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  brand: `
    bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-blue-light)]
    text-white font-semibold
    shadow-[var(--elevation-2)] shadow-[var(--shadow-blue)]
    hover:shadow-[var(--elevation-3)] hover:brightness-105 hover:-translate-y-[1px]
    active:scale-[0.98] active:shadow-[var(--elevation-1)]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none
  `,
  success: `
    bg-gradient-to-br from-[var(--success)] to-[var(--success-vivid)]
    text-white font-semibold
    shadow-[0_4px_12px_rgba(5,150,105,0.25)]
    hover:brightness-105 hover:-translate-y-[1px]
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm min-h-[36px] rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm min-h-[44px] rounded-xl gap-2',
  lg: 'px-6 py-3 text-base min-h-[52px] rounded-xl gap-2.5',
};

/**
 * Standardized Button Component
 *
 * Features:
 * - Consistent sizing with minimum touch targets (44px+)
 * - Multiple variants for different use cases
 * - Loading state with spinner
 * - Support for icons
 * - Accessible with proper focus states
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-medium
          transition-all duration-150 ease-out
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
          touch-manipulation
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Icon Button variant for icon-only buttons
 */
export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'children'> {
  /** Icon to display */
  icon: ReactNode;
  /** Accessible label (required for icon-only buttons) */
  'aria-label': string;
}

const iconSizeClasses = {
  sm: 'w-9 h-9 min-h-[36px] min-w-[36px]',
  md: 'w-11 h-11 min-h-[44px] min-w-[44px]',
  lg: 'w-13 h-13 min-h-[52px] min-w-[52px]',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      loading = false,
      icon,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          rounded-xl
          transition-all duration-150 ease-out
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
          touch-manipulation
          ${variantClasses[variant]}
          ${iconSizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default Button;
