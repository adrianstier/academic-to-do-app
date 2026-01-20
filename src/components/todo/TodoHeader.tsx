'use client';

import { memo } from 'react';
import { LayoutList, LayoutGrid } from 'lucide-react';
import { AuthUser, ViewMode } from '@/types/todo';
import UserSwitcher from '../UserSwitcher';
import AppMenu from '../AppMenu';
import FocusModeToggle from '../FocusModeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useTodoStore } from '@/store/todoStore';

interface TodoHeaderProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  canViewArchive: boolean;
  setShowActivityFeed: (show: boolean) => void;
  setShowArchiveView: (show: boolean) => void;
  setShowStrategicDashboard: (show: boolean) => void;
  setShowWeeklyChart: (show: boolean) => void;
  setShowShortcuts: (show: boolean) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (show: boolean) => void;
  onResetFilters: () => void;
}

/**
 * TodoHeader - Unified single-row header component
 *
 * Layout:
 * - Left side: View toggle (List/Board), Focus mode toggle
 * - Right side: User switcher, Menu button
 *
 * Hidden in focus mode except for the focus mode toggle button.
 */
function TodoHeader({
  currentUser,
  onUserChange,
  viewMode,
  setViewMode,
  canViewArchive,
  setShowActivityFeed,
  setShowArchiveView,
  setShowStrategicDashboard,
  setShowWeeklyChart,
  setShowShortcuts,
  showAdvancedFilters,
  setShowAdvancedFilters,
  onResetFilters,
}: TodoHeaderProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const userName = currentUser.name;
  const { focusMode } = useTodoStore((state) => state.ui);

  return (
    <header
      className={`sticky top-0 z-40 border-b ${
        darkMode
          ? 'bg-[var(--surface)] border-white/5'
          : 'bg-white border-[var(--border)]'
      }`}
    >
      <div className="mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Left side: View toggle & Focus mode toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View toggle - hidden in focus mode */}
            {!focusMode && (
              <div
                className={`flex backdrop-blur-sm rounded-lg sm:rounded-xl p-0.5 sm:p-1 border ${
                  darkMode
                    ? 'bg-white/8 border-white/10'
                    : 'bg-[var(--surface-2)] border-[var(--border)]'
                }`}
              >
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-medium transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-[var(--brand-sky)] text-[var(--brand-navy)] shadow-md'
                      : darkMode
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-3)]'
                  }`}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-medium transition-all duration-200 ${
                    viewMode === 'kanban'
                      ? 'bg-[var(--brand-sky)] text-[var(--brand-navy)] shadow-md'
                      : darkMode
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-3)]'
                  }`}
                  aria-pressed={viewMode === 'kanban'}
                  aria-label="Board view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Board</span>
                </button>
              </div>
            )}

            {/* Focus Mode Toggle - always visible */}
            <FocusModeToggle />
          </div>

          {/* Right side: User switcher & Menu - hidden in focus mode */}
          {!focusMode && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />

              <AppMenu
                userName={userName}
                canViewArchive={canViewArchive}
                onShowActivityFeed={() => setShowActivityFeed(true)}
                onShowWeeklyChart={() => setShowWeeklyChart(true)}
                onShowStrategicDashboard={() => setShowStrategicDashboard(true)}
                onShowArchive={() => setShowArchiveView(true)}
                onShowShortcuts={() => setShowShortcuts(true)}
                onShowAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
                onResetFilters={onResetFilters}
                showAdvancedFilters={showAdvancedFilters}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(TodoHeader);
