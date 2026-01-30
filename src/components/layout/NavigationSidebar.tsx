'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  Archive,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Plus,
  Inbox,
  BarChart2,
  Keyboard,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthUser, isOwner } from '@/types/todo';
import { useAppShell, ActiveView } from './AppShell';
import { useTeam } from '@/contexts/TeamContext';
import { TeamSwitcher } from '@/components/TeamSwitcher';

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION SIDEBAR
// A refined, collapsible navigation with clear visual hierarchy
// Inspired by Linear, Notion, and Figma's elegant sidebar patterns
// ═══════════════════════════════════════════════════════════════════════════

interface NavigationSidebarProps {
  currentUser: AuthUser;
  onUserChange?: (user: AuthUser | null) => void;
  onShowWeeklyChart?: () => void;
  onShowShortcuts?: () => void;
}

interface NavItem {
  id: ActiveView;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  badgeColor?: string;
  ownerOnly?: boolean;
}

const primaryNavItems: NavItem[] = [
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'ai_inbox', label: 'AI Inbox', icon: Inbox },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const secondaryNavItems: NavItem[] = [
  { id: 'goals', label: 'Strategic Goals', icon: Target, ownerOnly: true },
  { id: 'archive', label: 'Archive', icon: Archive },
];

export default function NavigationSidebar({
  currentUser,
  onUserChange,
  onShowWeeklyChart,
  onShowShortcuts,
}: NavigationSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';
  const {
    activeView,
    setActiveView,
    sidebarCollapsed,
    toggleSidebar,
    openCommandPalette,
    openRightPanel,
    triggerNewTask,
  } = useAppShell();

  // Multi-tenancy context
  const { currentTeam, isMultiTenancyEnabled } = useTeam();

  const [hovering, setHovering] = useState(false);

  // Determine if the sidebar should be expanded (collapsed=false OR hovering while collapsed)
  const isExpanded = !sidebarCollapsed || hovering;

  // Keyboard shortcut hint
  const shortcutKey = typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

  const handleLogout = () => {
    if (onUserChange) {
      localStorage.removeItem('todoSession');
      onUserChange(null);
    }
  };

  const navItemClass = (isActive: boolean) => `
    group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
    font-medium text-sm transition-all duration-150 cursor-pointer
    ${isActive
      ? darkMode
        ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
        : 'bg-[var(--accent-light)] text-[var(--accent)]'
      : darkMode
        ? 'text-white/60 hover:text-white hover:bg-white/5'
        : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
    }
  `;

  const iconClass = (isActive: boolean) => `
    w-5 h-5 flex-shrink-0 transition-colors
    ${isActive
      ? 'text-[var(--accent)]'
      : darkMode
        ? 'text-white/40 group-hover:text-white/70'
        : 'text-[var(--text-muted)] group-hover:text-[var(--foreground)]'
    }
  `;

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isExpanded ? 260 : 72,
      }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => sidebarCollapsed && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`
        hidden md:flex flex-col flex-shrink-0 overflow-hidden
        border-r transition-colors
        ${darkMode
          ? 'bg-[var(--surface)] border-white/10'
          : 'bg-white border-[var(--border)]'
        }
      `}
      aria-label="Main navigation"
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border-subtle)]">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 overflow-hidden flex-1"
            >
              {/* Show TeamSwitcher when multi-tenancy is enabled */}
              {isMultiTenancyEnabled ? (
                <TeamSwitcher size="sm" showRole={false} />
              ) : (
                <>
                  {/* Logo/Brand - fallback when multi-tenancy disabled */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: currentTeam?.primary_color || 'var(--brand-navy)' }}
                  >
                    <span className="text-white font-bold text-sm font-serif">
                      {currentTeam?.name?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <div className="overflow-hidden">
                    <h1 className={`font-semibold text-sm truncate font-serif ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                      {currentTeam?.name || 'Academic Projects'}
                    </h1>
                    <p className={`text-xs truncate ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                      Research Manager
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
              style={{ backgroundColor: currentTeam?.primary_color || 'var(--brand-navy)' }}
            >
              <span className="text-white font-bold text-sm font-serif">
                {currentTeam?.name?.charAt(0) || 'A'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle - only visible when expanded */}
        {isExpanded && (
          <button
            onClick={toggleSidebar}
            className={`
              p-1.5 rounded-lg transition-colors
              ${darkMode
                ? 'text-white/40 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* ─── Quick Add Button ─── */}
      <div className="px-3 py-3">
        <button
          onClick={triggerNewTask}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
            font-medium text-sm transition-all
            bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-blue-light)]
            text-white shadow-md hover:shadow-lg hover:brightness-110
          `}
        >
          <Plus className="w-4 h-4" />
          {isExpanded && <span>New Task</span>}
        </button>
      </div>

      {/* ─── Primary Navigation ─── */}
      <nav className="px-3 py-2 space-y-1 overflow-y-auto" aria-label="Primary">
        {primaryNavItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={navItemClass(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={iconClass(isActive)} />
              {isExpanded && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className={`my-3 border-t ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}`} />

        {/* Section label */}
        {isExpanded && (
          <p className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-white/30' : 'text-[var(--text-light)]'}`}>
            More
          </p>
        )}

        {/* Secondary Navigation */}
        {secondaryNavItems
          .filter(item => !item.ownerOnly || isOwner(currentUser))
          .map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={navItemClass(isActive)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={iconClass(isActive)} />
                {isExpanded && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
              </button>
            );
          })}

        {/* ─── Utility Actions (integrated into nav) ─── */}
        {(onShowWeeklyChart || onShowShortcuts) && (
          <>
            {/* Divider before utility actions */}
            <div className={`my-3 border-t ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}`} />

            {/* Weekly Progress */}
            {onShowWeeklyChart && (
              <button
                onClick={onShowWeeklyChart}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                  font-medium text-sm transition-all duration-150
                  ${darkMode
                    ? 'text-white/60 hover:text-white hover:bg-white/5'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  }
                `}
              >
                <BarChart2 className={`w-5 h-5 flex-shrink-0 ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`} />
                {isExpanded && <span>Weekly Progress</span>}
              </button>
            )}

            {/* Keyboard Shortcuts */}
            {onShowShortcuts && (
              <button
                onClick={onShowShortcuts}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                  font-medium text-sm transition-all duration-150
                  ${darkMode
                    ? 'text-white/60 hover:text-white hover:bg-white/5'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  }
                `}
              >
                <Keyboard className={`w-5 h-5 flex-shrink-0 ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`} />
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left">Shortcuts</span>
                    <span className={`text-xs ${darkMode ? 'text-white/30' : 'text-[var(--text-light)]'}`}>?</span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </nav>

      {/* ─── Footer / User Section ─── */}
      <div className={`
        mt-auto border-t px-3 py-3 space-y-2
        ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
      `}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            transition-colors
            ${darkMode
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
            }
          `}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isExpanded && <span className="text-sm">{darkMode ? 'Light' : 'Dark'}</span>}
        </button>

        {/* User profile */}
        <div className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl
          transition-colors cursor-pointer
          ${darkMode
            ? 'hover:bg-white/5'
            : 'hover:bg-[var(--surface-2)]'
          }
        `}>
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
            style={{ backgroundColor: currentUser.color }}
          >
            {currentUser.name[0]}
          </div>

          {isExpanded && (
            <>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                  {currentUser.name}
                </p>
                <p className={`text-xs truncate ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                  {currentUser.role === 'admin' ? 'Administrator' : 'Team Member'}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className={`
                  p-1.5 rounded-lg transition-colors
                  ${darkMode
                    ? 'text-white/40 hover:text-white hover:bg-white/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  }
                `}
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
