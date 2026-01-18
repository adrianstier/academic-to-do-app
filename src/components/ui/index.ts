/**
 * UI Component Library
 *
 * Centralized exports for all reusable UI components.
 * Import from '@/components/ui' for cleaner imports.
 */

// Button components
export { Button, IconButton } from './Button';
export type { ButtonProps, IconButtonProps } from './Button';

// Modal components
export { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
export type { ModalProps } from './Modal';

// Badge components
export {
  Badge,
  AnimatedBadge,
  CountBadge,
  StatusBadge,
} from './Badge';
export type {
  BadgeProps,
  AnimatedBadgeProps,
  CountBadgeProps,
  StatusBadgeProps,
  StatusType,
} from './Badge';

// Progress components
export {
  ProgressRing,
  MiniProgressRing,
  GoalProgressRing,
  StackedProgressRings,
} from './ProgressRing';
export type {
  ProgressRingProps,
  MiniProgressRingProps,
  GoalProgressRingProps,
  StackedProgressProps,
} from './ProgressRing';

// Toast components
export {
  ToastProvider,
  useToast,
} from './Toast';
export type {
  Toast,
  ToastVariant,
  ToastPosition,
  ToastProviderProps,
} from './Toast';

// Card components
export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from './Card';
export type {
  CardProps,
  CardHeaderProps,
  CardBodyProps,
  CardFooterProps,
  CardVariant,
  CardPadding,
  CardRadius,
} from './Card';

// Tooltip components
export {
  Tooltip,
  SimpleTooltip,
  TooltipTrigger,
} from './Tooltip';
export type {
  TooltipProps,
  TooltipPosition,
  TooltipAlign,
  SimpleTooltipProps,
  TooltipTriggerProps,
} from './Tooltip';

// Avatar components
export {
  Avatar,
  AvatarGroup,
  AnimatedAvatar,
  UserAvatar,
} from './Avatar';
export type {
  AvatarProps,
  AvatarGroupProps,
  AnimatedAvatarProps,
  UserAvatarProps,
  AvatarSize,
  AvatarStatus,
} from './Avatar';

// Skeleton components
export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonTodoItem,
  SkeletonList,
  SkeletonInline,
} from './Skeleton';
export type {
  SkeletonProps,
  SkeletonTextProps,
  SkeletonAvatarProps,
  SkeletonButtonProps,
  SkeletonCardProps,
  SkeletonTodoItemProps,
  SkeletonListProps,
  SkeletonInlineProps,
} from './Skeleton';
