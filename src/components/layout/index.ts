// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT COMPONENTS - Bealer Agency Task Manager
// A comprehensive, redesigned layout system for optimal UX
// ═══════════════════════════════════════════════════════════════════════════

// Core Layout
export { default as AppShell, useAppShell } from './AppShell';
export type { ActiveView, RightPanelContent } from './AppShell';

// Navigation
export { default as NavigationSidebar } from './NavigationSidebar';
export { default as EnhancedBottomNav, QuickFilterPills } from './EnhancedBottomNav';
export { default as CommandPalette } from './CommandPalette';

// Task Components
export { default as TaskCard, TaskCardSkeleton } from './TaskCard';
export { default as TaskDetailPanel } from './TaskDetailPanel';
