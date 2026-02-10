'use client';

import { Calendar, List, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { QuickFilter } from '@/types/todo';

interface Stats {
  total: number;
  completed: number;
  active: number;
  dueToday: number;
  overdue: number;
}

interface BottomTabsProps {
  stats: Stats;
  quickFilter: QuickFilter;
  showCompleted: boolean;
  onFilterChange: (filter: QuickFilter) => void;
  onShowCompletedChange: (show: boolean) => void;
}

interface Tab {
  id: QuickFilter | 'done';
  label: string;
  icon: typeof Calendar;
  count: number;
  color: string;
  activeColor: string;
}

export default function BottomTabs({
  stats,
  quickFilter,
  showCompleted,
  onFilterChange,
  onShowCompletedChange,
}: BottomTabsProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  const tabs: Tab[] = [
    {
      id: 'due_today',
      label: 'Today',
      icon: Calendar,
      count: stats.dueToday,
      color: 'var(--warning)',
      activeColor: 'var(--warning)',
    },
    {
      id: 'all',
      label: 'All',
      icon: List,
      count: stats.active,
      color: 'var(--accent)',
      activeColor: 'var(--accent)',
    },
    {
      id: 'done',
      label: 'Done',
      icon: CheckCircle,
      count: stats.completed,
      color: 'var(--success)',
      activeColor: 'var(--success)',
    },
  ];

  // Add overdue tab if there are overdue items
  if (stats.overdue > 0) {
    tabs.splice(0, 0, {
      id: 'overdue',
      label: 'Overdue',
      icon: AlertTriangle,
      count: stats.overdue,
      color: 'var(--danger)',
      activeColor: 'var(--danger)',
    });
  }

  const handleTabClick = (tabId: QuickFilter | 'done') => {
    if (tabId === 'done') {
      // Show completed tasks
      onFilterChange('all');
      onShowCompletedChange(true);
    } else {
      onShowCompletedChange(false);
      onFilterChange(tabId as QuickFilter);
    }
  };

  const isActive = (tabId: QuickFilter | 'done') => {
    if (tabId === 'done') {
      return showCompleted;
    }
    return quickFilter === tabId && !showCompleted;
  };

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden border-t safe-area-inset-bottom ${
        darkMode
          ? 'backdrop-blur-lg border-white/10'
          : 'bg-white/95 backdrop-blur-lg border-[var(--border)]'
      }`}
      style={darkMode ? { backgroundColor: 'color-mix(in srgb, var(--surface) 95%, transparent)' } : undefined}
      role="tablist"
      aria-label="Task filters"
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${tab.id}`}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-3 min-h-[56px] transition-all relative ${
                active
                  ? ''
                  : darkMode
                    ? 'text-white/40'
                    : 'text-[var(--text-muted)]'
              }`}
              style={active ? { color: tab.activeColor } : undefined}
            >
              {/* Active indicator bar */}
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full"
                  style={{ backgroundColor: tab.activeColor }}
                />
              )}

              {/* Icon with badge */}
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? '' : 'opacity-60'}`} />
                {tab.count > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded-full ${
                      active
                        ? 'text-white'
                        : darkMode
                          ? 'bg-white/20 text-white/60'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                    style={active ? { backgroundColor: tab.activeColor } : undefined}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[10px] font-medium ${active ? '' : 'opacity-60'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
