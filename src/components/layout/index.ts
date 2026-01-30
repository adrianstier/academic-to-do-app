// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT COMPONENTS - Academic Project Manager
// A comprehensive, redesigned layout system for optimal UX
// ═══════════════════════════════════════════════════════════════════════════

// Core Layout
export { default as AppShell, useAppShell } from './AppShell';
export type { ActiveView, RightPanelContent } from './AppShell';
export { default as AppLayout, ContentContainer, ViewTransition } from './AppLayout';
export { default as AppHeader } from './AppHeader';

// Navigation
export { default as NavigationSidebar } from './NavigationSidebar';
export { default as EnhancedBottomNav, QuickFilterPills } from './EnhancedBottomNav';
export { default as CommandPalette } from './CommandPalette';

// Task Components
export { default as TaskCard, TaskCardSkeleton } from './TaskCard';
export { default as TaskDetailPanel } from './TaskDetailPanel';
export { default as TaskBottomSheet } from './TaskBottomSheet';
