'use client';

import { useState, useCallback, useMemo } from 'react';
import { Bell, BellOff, Clock, X, Check, ChevronDown } from 'lucide-react';
import { format, addMinutes, addHours, addDays, startOfDay, setHours, setMinutes } from 'date-fns';
import type { ReminderPreset, ReminderType } from '@/types/todo';

interface ReminderPickerProps {
  value?: string; // ISO timestamp of current reminder
  dueDate?: string; // ISO timestamp of task due date
  onChange: (reminderTime: string | null, reminderType?: ReminderType) => void;
  compact?: boolean; // Compact mode for inline display
  className?: string;
}

interface QuickOption {
  id: ReminderPreset;
  label: string;
  icon: string;
  getTime: (dueDate?: Date) => Date | null;
}

const QUICK_OPTIONS: QuickOption[] = [
  {
    id: '5_min_before',
    label: '5 min before',
    icon: '⚡',
    getTime: (dueDate) => (dueDate ? addMinutes(dueDate, -5) : null),
  },
  {
    id: '15_min_before',
    label: '15 min before',
    icon: '🔔',
    getTime: (dueDate) => (dueDate ? addMinutes(dueDate, -15) : null),
  },
  {
    id: '30_min_before',
    label: '30 min before',
    icon: '⏱️',
    getTime: (dueDate) => (dueDate ? addMinutes(dueDate, -30) : null),
  },
  {
    id: '1_hour_before',
    label: '1 hour before',
    icon: '🕐',
    getTime: (dueDate) => (dueDate ? addHours(dueDate, -1) : null),
  },
  {
    id: '1_day_before',
    label: '1 day before',
    icon: '📅',
    getTime: (dueDate) => (dueDate ? addDays(dueDate, -1) : null),
  },
  {
    id: 'morning_of',
    label: '9 AM day of',
    icon: '🌅',
    getTime: (dueDate) => {
      if (!dueDate) return null;
      return setMinutes(setHours(startOfDay(dueDate), 9), 0);
    },
  },
];

export default function ReminderPicker({
  value,
  dueDate,
  onChange,
  compact = false,
  className = '',
}: ReminderPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  const parsedDueDate = useMemo(() => {
    if (!dueDate) return undefined;
    const date = new Date(dueDate);
    return isNaN(date.getTime()) ? undefined : date;
  }, [dueDate]);

  const parsedValue = useMemo(() => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  const formatReminderDisplay = useCallback((date: Date): string => {
    const now = new Date();
    const today = startOfDay(now);
    const reminderDay = startOfDay(date);
    const diffDays = Math.round(
      (reminderDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${format(date, 'h:mm a')}`;
    } else if (diffDays < 7) {
      return format(date, "EEEE 'at' h:mm a");
    } else {
      return format(date, "MMM d 'at' h:mm a");
    }
  }, []);

  const handleQuickOption = useCallback(
    (option: QuickOption) => {
      const time = option.getTime(parsedDueDate);
      if (time && time > new Date()) {
        onChange(time.toISOString(), 'both');
        setIsOpen(false);
        setShowCustom(false);
      }
    },
    [parsedDueDate, onChange]
  );

  const handleCustomSubmit = useCallback(() => {
    if (!customDate || !customTime) return;

    const [hours, minutes] = customTime.split(':').map(Number);
    const date = new Date(customDate);
    date.setHours(hours, minutes, 0, 0);

    if (date > new Date()) {
      onChange(date.toISOString(), 'both');
      setIsOpen(false);
      setShowCustom(false);
      setCustomDate('');
      setCustomTime('09:00');
    }
  }, [customDate, customTime, onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setIsOpen(false);
    setShowCustom(false);
  }, [onChange]);

  // Filter options to only show those that result in future times
  const availableOptions = useMemo(() => {
    const now = new Date();
    return QUICK_OPTIONS.filter((option) => {
      const time = option.getTime(parsedDueDate);
      return time && time > now;
    });
  }, [parsedDueDate]);

  if (compact) {
    // Compact mode: just a button that opens a dropdown
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] border transition-colors ${
            parsedValue
              ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]'
              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--border-hover)]'
          }`}
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          {parsedValue ? (
            <span className="text-sm truncate max-w-[120px]">
              {formatReminderDisplay(parsedValue)}
            </span>
          ) : (
            <span className="text-sm">Reminder</span>
          )}
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-2 w-64 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] z-50 overflow-hidden">
              <div className="p-2 space-y-1">
                {/* Quick options */}
                {availableOptions.length > 0 ? (
                  availableOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleQuickOption(option)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-lg)] text-left hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <span className="text-base">{option.icon}</span>
                      <span className="text-sm text-[var(--foreground)]">
                        {option.label}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-[var(--text-muted)]">
                    {parsedDueDate
                      ? 'All preset options are in the past'
                      : 'Set a due date to use presets'}
                  </p>
                )}

                {/* Divider */}
                <div className="border-t border-[var(--border)] my-1" />

                {/* Custom option */}
                <button
                  type="button"
                  onClick={() => setShowCustom(!showCustom)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-lg)] text-left hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--foreground)]">
                    Custom time
                  </span>
                </button>

                {/* Custom inputs */}
                {showCustom && (
                  <div className="px-3 py-2 space-y-2">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-3 py-2 text-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={handleCustomSubmit}
                      disabled={!customDate || !customTime}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      Set Reminder
                    </button>
                  </div>
                )}

                {/* Clear option (if reminder is set) */}
                {parsedValue && (
                  <>
                    <div className="border-t border-[var(--border)] my-1" />
                    <button
                      type="button"
                      onClick={handleClear}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-lg)] text-left hover:bg-[var(--danger-light)] transition-colors text-[var(--danger)]"
                    >
                      <BellOff className="w-4 h-4" />
                      <span className="text-sm">Remove reminder</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full mode: expanded view with all options visible
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            Reminder
          </span>
        </div>
        {parsedValue && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
            title="Remove reminder"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Current reminder display */}
      {parsedValue && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] bg-[var(--accent-light)] border border-[var(--accent)]/20">
          <Bell className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm text-[var(--accent)] font-medium">
            {formatReminderDisplay(parsedValue)}
          </span>
        </div>
      )}

      {/* Quick options grid */}
      <div className="grid grid-cols-2 gap-2">
        {QUICK_OPTIONS.map((option) => {
          const time = option.getTime(parsedDueDate);
          const isAvailable = time && time > new Date();
          const isSelected =
            parsedValue && time && Math.abs(parsedValue.getTime() - time.getTime()) < 60000;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => isAvailable && handleQuickOption(option)}
              disabled={!isAvailable}
              className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] border text-sm transition-colors ${
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]'
                  : isAvailable
                    ? 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]'
                    : 'border-[var(--border)] opacity-50 cursor-not-allowed'
              }`}
            >
              <span>{option.icon}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Custom time picker */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          min={format(new Date(), 'yyyy-MM-dd')}
          placeholder="Custom date"
          className="flex-1 px-3 py-2 text-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] focus:outline-none focus:border-[var(--accent)]"
        />
        <input
          type="time"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          className="w-24 px-3 py-2 text-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={handleCustomSubmit}
          disabled={!customDate || !customTime}
          className="p-2 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title="Set custom reminder"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
