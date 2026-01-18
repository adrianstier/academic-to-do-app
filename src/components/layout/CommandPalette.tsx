'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  CheckSquare,
  MessageCircle,
  LayoutDashboard,
  Activity,
  Target,
  Archive,
  Settings,
  Moon,
  Sun,
  Keyboard,
  Calendar,
  User,
  Filter,
  ArrowRight,
  Command,
  CornerDownLeft,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthUser, OWNER_USERNAME } from '@/types/todo';
import { useAppShell } from './AppShell';

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND PALETTE
// A powerful, keyboard-first command center for rapid navigation and actions
// Inspired by Linear, Raycast, and VS Code's command palette
// Accessible via ⌘K / Ctrl+K
// ═══════════════════════════════════════════════════════════════════════════

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  category: 'navigation' | 'actions' | 'settings' | 'recent';
  shortcut?: string;
  action: () => void;
  ownerOnly?: boolean;
}

export default function CommandPalette({
  isOpen,
  onClose,
  currentUser,
}: CommandPaletteProps) {
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';
  const { setActiveView, openRightPanel } = useAppShell();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Command definitions
  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-tasks',
      label: 'Go to Tasks',
      description: 'View and manage all tasks',
      icon: CheckSquare,
      category: 'navigation',
      shortcut: 'G T',
      action: () => { setActiveView('tasks'); onClose(); },
    },
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'View stats and progress',
      icon: LayoutDashboard,
      category: 'navigation',
      shortcut: 'G D',
      action: () => { setActiveView('dashboard'); onClose(); },
    },
    {
      id: 'nav-activity',
      label: 'Go to Activity',
      description: 'View recent activity feed',
      icon: Activity,
      category: 'navigation',
      shortcut: 'G A',
      action: () => { setActiveView('activity'); onClose(); },
    },
    {
      id: 'nav-chat',
      label: 'Go to Messages',
      description: 'Open team chat',
      icon: MessageCircle,
      category: 'navigation',
      shortcut: 'G M',
      action: () => { setActiveView('chat'); onClose(); },
    },
    {
      id: 'nav-goals',
      label: 'Go to Strategic Goals',
      description: 'View and manage business goals',
      icon: Target,
      category: 'navigation',
      shortcut: 'G G',
      action: () => { setActiveView('goals'); onClose(); },
      ownerOnly: true,
    },
    {
      id: 'nav-archive',
      label: 'Go to Archive',
      description: 'View archived tasks',
      icon: Archive,
      category: 'navigation',
      action: () => { setActiveView('archive'); onClose(); },
    },

    // Actions
    {
      id: 'action-new-task',
      label: 'Create New Task',
      description: 'Add a new task to your list',
      icon: Plus,
      category: 'actions',
      shortcut: 'N',
      action: () => { setActiveView('tasks'); onClose(); /* TODO: focus add task input */ },
    },
    {
      id: 'action-filter-today',
      label: 'Filter: Due Today',
      description: 'Show tasks due today',
      icon: Calendar,
      category: 'actions',
      action: () => { setActiveView('tasks'); onClose(); /* TODO: apply filter */ },
    },
    {
      id: 'action-filter-my-tasks',
      label: 'Filter: My Tasks',
      description: 'Show tasks assigned to you',
      icon: User,
      category: 'actions',
      action: () => { setActiveView('tasks'); onClose(); /* TODO: apply filter */ },
    },
    {
      id: 'action-filter-overdue',
      label: 'Filter: Overdue',
      description: 'Show overdue tasks',
      icon: Filter,
      category: 'actions',
      action: () => { setActiveView('tasks'); onClose(); /* TODO: apply filter */ },
    },

    // Settings
    {
      id: 'settings-theme',
      label: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      description: 'Toggle between light and dark theme',
      icon: darkMode ? Sun : Moon,
      category: 'settings',
      action: () => { toggleTheme(); onClose(); },
    },
    {
      id: 'settings-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: Keyboard,
      category: 'settings',
      shortcut: '?',
      action: () => { onClose(); /* TODO: open shortcuts modal */ },
    },
  ], [darkMode, toggleTheme, setActiveView, openRightPanel, onClose]);

  // Filter commands based on query and user permissions
  const filteredCommands = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();

    return commands
      .filter(cmd => {
        // Owner-only commands
        if (cmd.ownerOnly && currentUser.name !== OWNER_USERNAME) {
          return false;
        }

        // Search filter
        if (!lowerQuery) return true;
        return (
          cmd.label.toLowerCase().includes(lowerQuery) ||
          cmd.description?.toLowerCase().includes(lowerQuery) ||
          cmd.category.toLowerCase().includes(lowerQuery)
        );
      });
  }, [commands, query, currentUser.name]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      settings: [],
    };

    filteredCommands.forEach(cmd => {
      if (groups[cmd.category]) {
        groups[cmd.category].push(cmd);
      }
    });

    return groups;
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    return [
      ...groupedCommands.navigation,
      ...groupedCommands.actions,
      ...groupedCommands.settings,
    ];
  }, [groupedCommands]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector('[data-selected="true"]');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className={`
              fixed top-[20%] left-1/2 -translate-x-1/2 z-50
              w-full max-w-xl mx-4 sm:mx-auto
              rounded-2xl overflow-hidden shadow-2xl
              ${darkMode
                ? 'bg-[var(--surface)] border border-white/10'
                : 'bg-white border border-[var(--border)]'
              }
            `}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            {/* Search Input */}
            <div className={`
              flex items-center gap-3 px-4 py-4 border-b
              ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
            `}>
              <Search className={`w-5 h-5 ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className={`
                  flex-1 bg-transparent outline-none text-base
                  ${darkMode ? 'text-white placeholder-white/40' : 'text-[var(--foreground)] placeholder-[var(--text-muted)]'}
                `}
                aria-label="Search commands"
              />
              <kbd className={`
                hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                ${darkMode
                  ? 'bg-white/10 text-white/40'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                }
              `}>
                esc
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-80 overflow-y-auto py-2"
              role="listbox"
            >
              {flatCommands.length === 0 ? (
                <div className={`
                  px-4 py-8 text-center
                  ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}
                `}>
                  <p className="text-sm">No commands found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, items]) => {
                  if (items.length === 0) return null;

                  const startIndex = flatCommands.indexOf(items[0]);

                  return (
                    <div key={category} className="mb-2 last:mb-0">
                      <p className={`
                        px-4 py-2 text-xs font-semibold uppercase tracking-wider
                        ${darkMode ? 'text-white/30' : 'text-[var(--text-light)]'}
                      `}>
                        {categoryLabels[category]}
                      </p>

                      {items.map((cmd, idx) => {
                        const globalIdx = startIndex + idx;
                        const isSelected = selectedIndex === globalIdx;
                        const Icon = cmd.icon;

                        return (
                          <button
                            key={cmd.id}
                            onClick={cmd.action}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            data-selected={isSelected}
                            className={`
                              w-full flex items-center gap-3 px-4 py-3 text-left
                              transition-colors
                              ${isSelected
                                ? darkMode
                                  ? 'bg-white/10'
                                  : 'bg-[var(--surface-2)]'
                                : ''
                              }
                            `}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className={`
                              w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                              ${darkMode
                                ? 'bg-white/10'
                                : 'bg-[var(--surface-2)]'
                              }
                            `}>
                              <Icon className={`w-4 h-4 ${darkMode ? 'text-white/70' : 'text-[var(--foreground)]'}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                                {cmd.label}
                              </p>
                              {cmd.description && (
                                <p className={`text-xs truncate ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
                                  {cmd.description}
                                </p>
                              )}
                            </div>

                            {cmd.shortcut && (
                              <kbd className={`
                                flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                                ${darkMode
                                  ? 'bg-white/10 text-white/40'
                                  : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                                }
                              `}>
                                {cmd.shortcut}
                              </kbd>
                            )}

                            {isSelected && (
                              <ArrowRight className={`w-4 h-4 ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className={`
              flex items-center justify-between px-4 py-3 border-t text-xs
              ${darkMode
                ? 'border-white/10 text-white/40'
                : 'border-[var(--border)] text-[var(--text-muted)]'
              }
            `}>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-2)]'}`}>↑</kbd>
                  <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-2)]'}`}>↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className={`px-1.5 py-0.5 rounded flex items-center ${darkMode ? 'bg-white/10' : 'bg-[var(--surface-2)]'}`}>
                    <CornerDownLeft className="w-3 h-3" />
                  </kbd>
                  Select
                </span>
              </div>

              <span className="flex items-center gap-1">
                <Command className="w-3 h-3" />K to toggle
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
