'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Menu,
  X,
  Activity,
  BarChart2,
  Target,
  Archive,
  Keyboard,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { OWNER_USERNAME } from '@/types/todo';

interface AppMenuProps {
  userName: string;
  canViewArchive: boolean;
  onShowActivityFeed: () => void;
  onShowWeeklyChart: () => void;
  onShowStrategicDashboard: () => void;
  onShowArchive: () => void;
  onShowShortcuts: () => void;
  onShowAdvancedFilters: () => void;
  onResetFilters: () => void;
  showAdvancedFilters: boolean;
}

export default function AppMenu({
  userName,
  canViewArchive,
  onShowActivityFeed,
  onShowWeeklyChart,
  onShowStrategicDashboard,
  onShowArchive,
  onShowShortcuts,
  onShowAdvancedFilters,
  onResetFilters,
  showAdvancedFilters,
}: AppMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const menuItemClass = `flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors ${
    darkMode
      ? 'text-white/80 hover:bg-white/10 hover:text-white'
      : 'text-[var(--foreground)] hover:bg-[var(--surface-2)]'
  }`;

  const dividerClass = `border-t ${darkMode ? 'border-white/10' : 'border-[var(--border)]'} my-1`;

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl transition-all duration-200 ${
          darkMode
            ? 'text-white/60 hover:text-white hover:bg-white/10'
            : 'text-[var(--text-muted)] hover:text-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
        } ${isOpen ? (darkMode ? 'bg-white/10 text-white' : 'bg-[var(--surface-2)] text-[var(--brand-blue)]') : ''}`}
        aria-label="Menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div
            className={`absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
              darkMode
                ? 'bg-[var(--surface)] border-white/10'
                : 'bg-white border-[var(--border)]'
            }`}
            role="menu"
            aria-orientation="vertical"
          >
            {/* Menu Header */}
            <div className={`px-4 py-3 border-b ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                Menu
              </p>
            </div>

            {/* Views Section */}
            <div className="py-1">
              <button
                onClick={() => handleMenuItemClick(onShowActivityFeed)}
                className={menuItemClass}
                role="menuitem"
              >
                <Activity className="w-4 h-4 flex-shrink-0" />
                <span>Activity Feed</span>
              </button>

              <button
                onClick={() => handleMenuItemClick(onShowWeeklyChart)}
                className={menuItemClass}
                role="menuitem"
              >
                <BarChart2 className="w-4 h-4 flex-shrink-0" />
                <span>Weekly Progress</span>
              </button>

              {/* Strategic Goals - Owner only */}
              {userName === OWNER_USERNAME && (
                <button
                  onClick={() => handleMenuItemClick(onShowStrategicDashboard)}
                  className={menuItemClass}
                  role="menuitem"
                >
                  <Target className="w-4 h-4 flex-shrink-0" />
                  <span>Strategic Goals</span>
                </button>
              )}

              {/* Archive - Admin/Owner only */}
              {canViewArchive && (
                <button
                  onClick={() => handleMenuItemClick(onShowArchive)}
                  className={menuItemClass}
                  role="menuitem"
                >
                  <Archive className="w-4 h-4 flex-shrink-0" />
                  <span>Archive</span>
                </button>
              )}
            </div>

            <div className={dividerClass} />

            {/* Settings Section */}
            <div className="py-1">
              <button
                onClick={() => handleMenuItemClick(onShowShortcuts)}
                className={menuItemClass}
                role="menuitem"
              >
                <Keyboard className="w-4 h-4 flex-shrink-0" />
                <span>Keyboard Shortcuts</span>
                <span className={`text-xs ml-auto ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>?</span>
              </button>
            </div>

            <div className={dividerClass} />

            {/* Filters Section */}
            <div className="py-1">
              <button
                onClick={() => handleMenuItemClick(onShowAdvancedFilters)}
                className={menuItemClass}
                role="menuitem"
              >
                <Filter className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Advanced Filters</span>
                {showAdvancedFilters && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${darkMode ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--accent-light)] text-[var(--accent)]'}`}>
                    On
                  </span>
                )}
              </button>

              <button
                onClick={() => handleMenuItemClick(onResetFilters)}
                className={menuItemClass}
                role="menuitem"
              >
                <RotateCcw className="w-4 h-4 flex-shrink-0" />
                <span>Reset All Filters</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
