'use client';

import { forwardRef, ReactNode, HTMLAttributes, createContext, useContext } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export type CardVariant = 'default' | 'elevated' | 'glass' | 'glassPremium' | 'academic';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardRadius = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the card */
  variant?: CardVariant;
  /** Whether the card is interactive (adds hover effects) */
  interactive?: boolean;
  /** Whether the card is in a selected state */
  selected?: boolean;
  /** Padding size for the card */
  padding?: CardPadding;
  /** Border radius size */
  radius?: CardRadius;
  /** Card content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Render as a different element (for semantic HTML) */
  as?: 'div' | 'article' | 'section' | 'aside';
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  /** Whether to include a bottom border */
  bordered?: boolean;
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  /** Whether to include a top border */
  bordered?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

interface CardContextValue {
  padding: CardPadding;
}

const CardContext = createContext<CardContextValue>({ padding: 'md' });

const useCardContext = () => useContext(CardContext);

// ═══════════════════════════════════════════════════════════════════════════
// STYLE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

const variantClasses: Record<CardVariant, string> = {
  default: 'card-base',
  elevated: 'card-elevated',
  glass: 'glass-card card-base',
  glassPremium: 'glass-card-premium',
  academic: 'card-elevated paper-texture academic-pattern',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

const headerPaddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'px-3 pt-3 pb-2',
  md: 'px-4 sm:px-5 pt-4 sm:pt-5 pb-3',
  lg: 'px-5 sm:px-6 pt-5 sm:pt-6 pb-4',
};

const bodyPaddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'px-3 py-2',
  md: 'px-4 sm:px-5 py-3 sm:py-4',
  lg: 'px-5 sm:px-6 py-4 sm:py-5',
};

const footerPaddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'px-3 pt-2 pb-3',
  md: 'px-4 sm:px-5 pt-3 pb-4 sm:pb-5',
  lg: 'px-5 sm:px-6 pt-4 pb-5 sm:pb-6',
};

const radiusClasses: Record<CardRadius, string> = {
  sm: 'rounded-[var(--radius-sm)]',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  '2xl': 'rounded-[var(--radius-2xl)]',
};

// ═══════════════════════════════════════════════════════════════════════════
// CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Card Component
 *
 * A versatile container component for grouping related content.
 *
 * Features:
 * - Multiple visual variants (default, elevated, glass, glassPremium)
 * - Interactive mode with hover lift effect
 * - Selected state styling
 * - Configurable padding and border radius
 * - Compound components for structured layouts
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Card>Content here</Card>
 *
 * // With variants
 * <Card variant="elevated" interactive>
 *   Clickable elevated card
 * </Card>
 *
 * // With compound components
 * <Card variant="glass" padding="lg">
 *   <CardHeader bordered>Title</CardHeader>
 *   <CardBody>Main content</CardBody>
 *   <CardFooter bordered>Actions</CardFooter>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      interactive = false,
      selected = false,
      padding = 'md',
      radius = 'lg',
      children,
      className = '',
      as: Component = 'div',
      role,
      tabIndex,
      ...props
    },
    ref
  ) => {
    // Build class list
    const classes = [
      variantClasses[variant],
      interactive && 'card-hoverable',
      selected && 'card-selected',
      // Only apply padding if not using compound components
      // (detected by checking if children are Card sub-components)
      !hasCompoundChildren(children) && paddingClasses[padding],
      radiusClasses[radius],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Determine appropriate role and tabIndex for interactive cards
    const computedRole = role ?? (interactive ? 'button' : undefined);
    const computedTabIndex = tabIndex ?? (interactive ? 0 : undefined);

    return (
      <CardContext.Provider value={{ padding }}>
        <Component
          ref={ref}
          className={classes}
          role={computedRole}
          tabIndex={computedTabIndex}
          {...props}
        >
          {children}
        </Component>
      </CardContext.Provider>
    );
  }
);

Card.displayName = 'Card';

// ═══════════════════════════════════════════════════════════════════════════
// CARD HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Card Header Component
 *
 * Use within a Card to create a distinct header section.
 * Inherits padding from parent Card context.
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', bordered = false, ...props }, ref) => {
    const { padding } = useCardContext();

    const classes = [
      headerPaddingClasses[padding],
      bordered && 'border-b border-[var(--border-subtle)]',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// ═══════════════════════════════════════════════════════════════════════════
// CARD BODY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Card Body Component
 *
 * Main content area of a Card.
 * Inherits padding from parent Card context.
 */
export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className = '', ...props }, ref) => {
    const { padding } = useCardContext();

    const classes = [bodyPaddingClasses[padding], className]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// ═══════════════════════════════════════════════════════════════════════════
// CARD FOOTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Card Footer Component
 *
 * Use within a Card to create a distinct footer section.
 * Inherits padding from parent Card context.
 */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', bordered = false, ...props }, ref) => {
    const { padding } = useCardContext();

    const classes = [
      footerPaddingClasses[padding],
      bordered && 'border-t border-[var(--border-subtle)] bg-[var(--surface-2)]',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if children contain Card compound components
 * Used to determine whether to apply direct padding to Card
 */
function hasCompoundChildren(children: ReactNode): boolean {
  if (!children) return false;

  // Check if any direct children are compound components
  const childArray = Array.isArray(children) ? children : [children];

  return childArray.some((child) => {
    if (typeof child !== 'object' || child === null) return false;
    if (!('type' in child)) return false;

    const type = child.type;
    if (typeof type === 'function' || typeof type === 'object') {
      const displayName =
        (type as { displayName?: string }).displayName ||
        (type as { name?: string }).name;
      return ['CardHeader', 'CardBody', 'CardFooter'].includes(displayName || '');
    }
    return false;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default Card;
