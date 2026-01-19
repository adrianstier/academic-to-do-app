'use client';

import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTodoStore } from '@/store/todoStore';
import { LayoutList, LayoutGrid, Home } from 'lucide-react';
import { ViewMode } from '@/types/todo';

interface AppHeaderProps {
  /** View mode for the toggle */
  viewMode: ViewMode;
  /** Callback when view mode changes */
  onViewModeChange: (mode: ViewMode) => void;
  /** Stats to display in header subtitle */
  stats: {
    active: number;
    dueToday: number;
    overdue: number;
  };
  /** Optional callback to open dashboard */
  onOpenDashboard?: () => void;
  /** Right side content (user switcher, menu, etc) */
  rightContent?: ReactNode;
}

/**
 * AppHeader provides a consistent header across the app with:
 * - Logo and app name
 * - Stats subtitle
 * - View toggle (List/Board)
 * - Right-side actions (passed as children)
 *
 * In focus mode, only shows logo and exit button
 */
export default function AppHeader({
  viewMode,
  onViewModeChange,
  stats,
  onOpenDashboard,
  rightContent,
}: AppHeaderProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const { focusMode } = useTodoStore((state) => state.ui);

  return (
    <header
      className={`
        shadow-[var(--shadow-lg)] border-b
        ${darkMode
          ? 'bg-[var(--gradient-hero)] border-white/5'
          : 'bg-white border-[var(--border)]'
        }
      `}
    >
      {/* Content container - consistent width */}
      <div className="mx-auto px-4 sm:px-6 py-4 max-w-full">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Logo & Context Info */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Dashboard button - hidden in focus mode */}
            {onOpenDashboard && !focusMode && (
              <button
                onClick={onOpenDashboard}
                className={`p-2 rounded-xl transition-all flex-shrink-0 ${
                  darkMode
                    ? 'hover:bg-white/10 text-white/70 hover:text-white'
                    : 'hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }`}
                title="Daily Summary"
              >
                <Home className="w-5 h-5" />
              </button>
            )}

            {/* Logo */}
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ boxShadow: '0 4px 12px rgba(0, 51, 160, 0.35)' }}
            >
              <span className="text-white font-bold text-base">B</span>
            </div>

            {/* Title & Stats */}
            <div className="min-w-0">
              <h1
                className={`text-base font-bold truncate tracking-tight ${
                  darkMode ? 'text-white' : 'text-[var(--brand-navy)]'
                }`}
              >
                Bealer Agency
              </h1>
              {!focusMode && (
                <p
                  className={`text-xs truncate ${
                    darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {stats.active} active
                  {stats.dueToday > 0 && ` \u2022 ${stats.dueToday} due today`}
                  {stats.overdue > 0 && ` \u2022 ${stats.overdue} overdue`}
                </p>
              )}
            </div>
          </div>

          {/* Right: View toggle + actions */}
          <div className="flex items-center gap-1.5">
            {/* View toggle - hidden in focus mode */}
            {!focusMode && (
              <div
                className={`flex backdrop-blur-sm rounded-xl p-1 border ${
                  darkMode
                    ? 'bg-white/8 border-white/10'
                    : 'bg-[var(--surface-2)] border-[var(--border)]'
                }`}
              >
                <button
                  onClick={() => onViewModeChange('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
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
                  onClick={() => onViewModeChange('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
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

            {/* Right side content (Focus toggle, user switcher, menu) */}
            {rightContent}
          </div>
        </div>
      </div>
    </header>
  );
}
