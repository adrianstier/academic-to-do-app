'use client';

type CalendarViewMode = 'day' | 'week' | 'month';

interface CalendarViewSwitcherProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

const VIEW_OPTIONS: { mode: CalendarViewMode; label: string; shortcut: string }[] = [
  { mode: 'day', label: 'Day', shortcut: 'D' },
  { mode: 'week', label: 'Week', shortcut: 'W' },
  { mode: 'month', label: 'Month', shortcut: 'M' },
];

export default function CalendarViewSwitcher({
  viewMode,
  onViewModeChange,
}: CalendarViewSwitcherProps) {
  return (
    <div role="tablist" aria-label="Calendar view" className="flex items-center bg-[var(--surface-2)] rounded-lg p-0.5 border border-[var(--border)]">
      {VIEW_OPTIONS.map(({ mode, label, shortcut }) => (
        <button
          key={mode}
          role="tab"
          aria-selected={viewMode === mode}
          onClick={() => onViewModeChange(mode)}
          title={`${label} view (${shortcut})`}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150
            ${
              viewMode === mode
                ? 'bg-[var(--accent)] text-white shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
            }
          `}
        >
          {label}
          <span className={`ml-1 text-xs ${viewMode === mode ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
            {shortcut}
          </span>
        </button>
      ))}
    </div>
  );
}
