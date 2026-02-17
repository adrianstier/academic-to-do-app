'use client';

import { useState, useCallback, useEffect, useMemo, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthUser, isOwner } from '@/types/todo';
import { useTodoStore } from '@/store/todoStore';
import NavigationSidebar from './NavigationSidebar';
import CommandPalette from './CommandPalette';
import EnhancedBottomNav from './EnhancedBottomNav';
import FloatingChatButton from '../FloatingChatButton';

// ═══════════════════════════════════════════════════════════════════════════
// APP SHELL - CORE LAYOUT ARCHITECTURE
// A sophisticated three-column layout with persistent navigation and panels
// Designed for academic research team task management workflows
// ═══════════════════════════════════════════════════════════════════════════

export type ActiveView =
  | 'tasks'
  | 'dashboard'
  | 'activity'
  | 'chat'
  | 'goals'
  | 'archive'
  | 'ai_inbox'
  | 'projects'
  | 'pipeline'
  | 'gantt'
  | 'equipment'
  | 'integrations';

export type RightPanelContent =
  | { type: 'chat' }
  | { type: 'task-detail'; taskId: string }
  | { type: 'activity' }
  | null;

interface AppShellContextType {
  // Navigation
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Sidebar state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Right panel
  rightPanel: RightPanelContent;
  openRightPanel: (content: RightPanelContent) => void;
  closeRightPanel: () => void;

  // Command palette
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Mobile sheet
  mobileSheetOpen: boolean;
  mobileSheetContent: 'menu' | 'filters' | 'chat' | null;
  openMobileSheet: (content: 'menu' | 'filters' | 'chat') => void;
  closeMobileSheet: () => void;

  // New task trigger
  triggerNewTask: () => void;
  onNewTaskTrigger: (callback: () => void) => void;

  // Modal state (Weekly Progress, Keyboard Shortcuts)
  showWeeklyChart: boolean;
  openWeeklyChart: () => void;
  closeWeeklyChart: () => void;
  showShortcuts: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;

  // User info
  currentUser: AuthUser | null;
}

const AppShellContext = createContext<AppShellContextType | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }
  return context;
}

interface AppShellProps {
  children: ReactNode;
  currentUser: AuthUser;
  rightPanelContent?: ReactNode;
  onUserChange?: (user: AuthUser | null) => void;
}

export default function AppShell({
  children,
  currentUser,
  rightPanelContent,
  onUserChange
}: AppShellProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  
  // Get users from store for FloatingChatButton
  const users = useTodoStore((state) => state.usersWithColors);

  // Navigation state
  const [activeView, setActiveViewRaw] = useState<ActiveView>('tasks');

  // Sidebar state - collapsed by default on tablet, expanded on desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Right panel state
  const [rightPanel, setRightPanel] = useState<RightPanelContent>(null);

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Mobile sheet state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSheetContent, setMobileSheetContent] = useState<'menu' | 'filters' | 'chat' | null>(null);

  // Wrap setActiveView to also close mobile sheet when navigating
  const setActiveView = useCallback((view: ActiveView) => {
    setActiveViewRaw(view);
    // Close mobile sheet on navigation to prevent stale sheet state
    setMobileSheetOpen(false);
    setMobileSheetContent(null);
  }, []);

  // New task trigger callback - allows child components to register handlers
  const [newTaskCallback, setNewTaskCallback] = useState<(() => void) | null>(null);

  // Modal state for Weekly Progress and Shortcuts
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' ||
                           target.tagName === 'TEXTAREA' ||
                           target.isContentEditable;

      // Show keyboard shortcuts: ? (Shift + /)
      if (e.key === '?' && !isInputField) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      // Command palette: Cmd/Ctrl + K (works globally, even in input fields)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }

      // Toggle sidebar: Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b' && !isInputField) {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }

      // Close panels on Escape
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (showWeeklyChart) {
          setShowWeeklyChart(false);
        } else if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (rightPanel) {
          setRightPanel(null);
        } else if (mobileSheetOpen) {
          setMobileSheetOpen(false);
          setMobileSheetContent(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, rightPanel, mobileSheetOpen, showShortcuts, showWeeklyChart]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const openRightPanel = useCallback((content: RightPanelContent) => {
    setRightPanel(content);
  }, []);

  const closeRightPanel = useCallback(() => {
    setRightPanel(null);
  }, []);

  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  const openMobileSheet = useCallback((content: 'menu' | 'filters' | 'chat') => {
    setMobileSheetContent(content);
    setMobileSheetOpen(true);
  }, []);

  const closeMobileSheet = useCallback(() => {
    setMobileSheetOpen(false);
    setMobileSheetContent(null);
  }, []);

  // New task trigger - calls registered callback and switches to tasks view
  const triggerNewTask = useCallback(() => {
    setActiveView('tasks');
    // Small delay to ensure view is switched before triggering callback
    setTimeout(() => {
      if (newTaskCallback) {
        newTaskCallback();
      }
    }, 50);
  }, [newTaskCallback]);

  // Handle task link click from chat - navigate to task and highlight it
  const handleTaskLinkClick = useCallback((taskId: string) => {
    // Navigate to tasks view
    setActiveView('tasks');
    // Small delay to ensure view switches, then scroll to task
    setTimeout(() => {
      const taskElement = document.getElementById(`todo-${taskId}`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add animated highlight class
        taskElement.classList.add('notification-highlight');
        // Remove the class after animation completes
        setTimeout(() => {
          taskElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 150);
  }, []);

  // Allow child components to register their new task handler
  const onNewTaskTrigger = useCallback((callback: () => void) => {
    setNewTaskCallback(() => callback);
  }, []);

  // Weekly chart modal controls
  const openWeeklyChart = useCallback(() => setShowWeeklyChart(true), []);
  const closeWeeklyChart = useCallback(() => setShowWeeklyChart(false), []);

  // Shortcuts modal controls
  const openShortcuts = useCallback(() => setShowShortcuts(true), []);
  const closeShortcuts = useCallback(() => setShowShortcuts(false), []);

  const contextValue: AppShellContextType = useMemo(() => ({
    activeView,
    setActiveView,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    rightPanel,
    openRightPanel,
    closeRightPanel,
    commandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    mobileSheetOpen,
    mobileSheetContent,
    openMobileSheet,
    closeMobileSheet,
    triggerNewTask,
    onNewTaskTrigger,
    showWeeklyChart,
    openWeeklyChart,
    closeWeeklyChart,
    showShortcuts,
    openShortcuts,
    closeShortcuts,
    currentUser,
  }), [
    activeView,
    setActiveView,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    rightPanel,
    openRightPanel,
    closeRightPanel,
    commandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    mobileSheetOpen,
    mobileSheetContent,
    openMobileSheet,
    closeMobileSheet,
    triggerNewTask,
    onNewTaskTrigger,
    showWeeklyChart,
    openWeeklyChart,
    closeWeeklyChart,
    showShortcuts,
    openShortcuts,
    closeShortcuts,
    currentUser,
  ]);

  return (
    <AppShellContext.Provider value={contextValue}>
      <div
        className={`
          min-h-screen min-h-[100dvh] flex flex-col
          transition-colors duration-200
          bg-[var(--background)]
        `}
      >
        {/* Skip link for accessibility */}
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>

        <div className="flex-1 flex overflow-hidden">
          {/* ═══ LEFT SIDEBAR ═══ */}
          <NavigationSidebar
            currentUser={currentUser}
            onUserChange={onUserChange}
            onShowWeeklyChart={openWeeklyChart}
            onShowShortcuts={openShortcuts}
          />

          {/* ═══ MAIN CONTENT AREA ═══ */}
          <main
            id="main-content"
            className={`
              flex-1 flex flex-col min-w-0 overflow-hidden
              transition-all duration-300 ease-out
            `}
          >
            {/* Main content with proper overflow handling */}
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </main>

          {/* ═══ RIGHT PANEL (Desktop) ═══ */}
          {/* Panel is visible on xl+ screens, with responsive width */}
          <AnimatePresence mode="wait">
            {rightPanel && rightPanelContent && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className={`
                  hidden lg:flex flex-col overflow-hidden
                  border-l flex-shrink-0
                  lg:w-[340px] xl:w-[380px] 2xl:w-[420px]
                  ${darkMode
                    ? 'bg-[var(--surface)] border-white/10'
                    : 'bg-white border-[var(--border)]'
                  }
                `}
              >
                {rightPanelContent}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ MOBILE BOTTOM NAVIGATION ═══ */}
        <EnhancedBottomNav />

        {/* ═══ FLOATING CHAT BUTTON ═══ */}
        <FloatingChatButton
          currentUser={currentUser}
          users={users}
          onTaskLinkClick={handleTaskLinkClick}
        />

        {/* ═══ COMMAND PALETTE ═══ */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={closeCommandPalette}
          currentUser={currentUser}
        />

        {/* ═══ MOBILE SHEET OVERLAY ═══ */}
        <AnimatePresence>
          {mobileSheetOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeMobileSheet}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
              />

              {/* Sheet */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                role="dialog"
                aria-modal="true"
                aria-label={
                  mobileSheetContent === 'menu' ? 'Navigation menu' :
                  mobileSheetContent === 'filters' ? 'Filters' :
                  mobileSheetContent === 'chat' ? 'Chat' :
                  'Sheet'
                }
                className={`
                  fixed inset-x-0 bottom-0 z-50 lg:hidden
                  max-h-[85vh] rounded-t-3xl overflow-hidden
                  ${darkMode
                    ? 'bg-[var(--surface)]'
                    : 'bg-white'
                  }
                `}
              >
                {/* Drag handle */}
                <div className="flex justify-center py-3">
                  <div
                    className={`
                      w-10 h-1 rounded-full
                      ${darkMode ? 'bg-white/20' : 'bg-[var(--border)]'}
                    `}
                  />
                </div>

                {/* Sheet content would be rendered here based on mobileSheetContent */}
                <div className="px-4 pb-safe overflow-auto max-h-[calc(85vh-44px)]">
                  {mobileSheetContent === 'menu' && (
                    <MobileMenuContent onClose={closeMobileSheet} />
                  )}
                  {mobileSheetContent === 'filters' && (
                    <MobileFiltersContent onClose={closeMobileSheet} />
                  )}
                  {mobileSheetContent === 'chat' && (
                    <div className="text-center py-8 text-[var(--text-muted)]">
                      Chat panel content
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppShellContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE SHEET CONTENT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function MobileMenuContent({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const { setActiveView, currentUser } = useAppShell();

  const menuItems = [
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'pipeline', label: 'Pipeline', icon: '📖' },
    { id: 'ai_inbox', label: 'AI Inbox', icon: '📥' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'activity', label: 'Activity', icon: '📈' },
    { id: 'chat', label: 'Messages', icon: '💬' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'gantt', label: 'Timeline', icon: '📅' },
    { id: 'equipment', label: 'Equipment', icon: '🔬' },
    { id: 'archive', label: 'Archive', icon: '🗄️' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
  ];

  const handleItemClick = (viewId: string) => {
    setActiveView(viewId as ActiveView);
    onClose();
  };

  return (
    <div className="space-y-2 pb-4">
      <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
        Navigation
      </h2>
      {menuItems.map(item => (
        <button
          key={item.id}
          onClick={() => handleItemClick(item.id)}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
            transition-colors
            ${darkMode
              ? 'text-white/80 hover:bg-white/10'
              : 'text-[var(--foreground)] hover:bg-[var(--surface-2)]'
            }
          `}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="font-medium">{item.label}</span>
        </button>
      ))}

      {isOwner(currentUser) && (
        <>
          <div className={`border-t my-4 ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}`} />
          <button
            onClick={() => handleItemClick('goals')}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
              transition-colors
              ${darkMode
                ? 'text-white/80 hover:bg-white/10'
                : 'text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
          >
            <span className="text-xl">🎯</span>
            <span className="font-medium">Strategic Goals</span>
          </button>
        </>
      )}
    </div>
  );
}

function MobileFiltersContent({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  return (
    <div className="space-y-4 pb-4">
      <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
        Filters
      </h2>
      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
        Filter controls will be rendered here
      </p>
    </div>
  );
}
