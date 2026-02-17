'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Check,
  Clock,
  Bell,
  Printer,
  FolderOpen,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfDay,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from 'date-fns';
import { Todo, TaskCategory } from '@/types/todo';

type CalendarViewMode = 'day' | 'week' | 'month';
import { useToast } from '@/components/ui/Toast';
import { CATEGORY_COLORS, CATEGORY_LABELS, ALL_CATEGORIES, PRIORITY_ORDER } from './constants';
import CalendarViewSwitcher from './CalendarViewSwitcher';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import MiniCalendar from './MiniCalendar';

interface CalendarViewProps {
  todos: Todo[];
  onTaskClick: (todo: Todo) => void;
  onDateClick: (date: Date) => void;
  onReschedule?: (todoId: string, newDate: string) => void;
  onQuickComplete?: (todoId: string) => void;
  onToggleWaiting?: (todoId: string, waiting: boolean) => void;
  onQuickAdd?: (dateKey: string, text: string) => void;
  activeProjectName?: string;
}

const headerVariants = {
  enter: (direction: 'left' | 'right') => ({
    x: direction === 'right' ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: 'left' | 'right') => ({
    x: direction === 'right' ? -50 : 50,
    opacity: 0,
  }),
};

function getHeaderLabel(viewMode: CalendarViewMode, currentDate: Date): string {
  switch (viewMode) {
    case 'month':
      return format(currentDate, 'MMMM yyyy');
    case 'week': {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      if (sameMonth) {
        return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`;
      }
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    case 'day':
      return format(currentDate, 'EEEE, MMMM d, yyyy');
  }
}

function getHeaderKey(viewMode: CalendarViewMode, currentDate: Date): string {
  switch (viewMode) {
    case 'month':
      return format(currentDate, 'yyyy-MM');
    case 'week':
      return format(startOfWeek(currentDate), 'yyyy-MM-dd');
    case 'day':
      return format(currentDate, 'yyyy-MM-dd');
  }
}

export default function CalendarView({
  todos,
  onTaskClick,
  onDateClick,
  onReschedule,
  onQuickComplete,
  onToggleWaiting,
  onQuickAdd,
  activeProjectName,
}: CalendarViewProps) {
  const toast = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedCategories, setSelectedCategories] = useState<Set<TaskCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set()); // empty = show all
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  // Navigation
  const goToPrevious = useCallback(() => {
    setDirection('left');
    setCurrentDate((prev) => {
      switch (viewMode) {
        case 'month': return subMonths(prev, 1);
        case 'week': return subWeeks(prev, 1);
        case 'day': return subDays(prev, 1);
      }
    });
  }, [viewMode]);

  const goToNext = useCallback(() => {
    setDirection('right');
    setCurrentDate((prev) => {
      switch (viewMode) {
        case 'month': return addMonths(prev, 1);
        case 'week': return addWeeks(prev, 1);
        case 'day': return addDays(prev, 1);
      }
    });
  }, [viewMode]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setDirection(startOfDay(today) > startOfDay(currentDate) ? 'right' : 'left');
    setCurrentDate(today);
  }, [currentDate]);

  const handleMiniCalendarDateClick = useCallback((date: Date) => {
    setDirection(date > currentDate ? 'right' : 'left');
    setCurrentDate(date);
    // Keep current view mode — don't switch to day view
  }, [currentDate]);

  // Wrap onReschedule to show a toast notification after drag-drop
  const handleCalendarReschedule = useCallback((todoId: string, newDate: string) => {
    if (onReschedule) {
      onReschedule(todoId, newDate);
      const formatted = format(new Date(newDate + 'T00:00:00'), 'MMM d, yyyy');
      toast.success(`Task moved to ${formatted}`);
    }
  }, [onReschedule, toast]);

  // Drill into day view when clicking a date in month/week views
  const handleDrillToDay = useCallback((date: Date) => {
    setDirection(date > currentDate ? 'right' : 'left');
    setCurrentDate(date);
    setViewMode('day');
  }, [currentDate]);

  // Keyboard shortcuts — scoped to when calendar container is visible
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle shortcuts when this component is in the DOM and visible
      if (!containerRef.current || containerRef.current.offsetParent === null) return;

      // Skip when a modal/dialog is open
      if (document.querySelector('[role="dialog"]')) return;

      // Skip when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      // Skip when modifier keys are held (except for Escape and arrows)
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key !== 'Escape' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      switch (e.key) {
        case 'Escape':
          if (showFilterMenu) {
            setShowFilterMenu(false);
            e.stopPropagation();
          }
          break;
        case 'd':
        case 'D':
          setViewMode('day');
          break;
        case 'w':
        case 'W':
          setViewMode('week');
          break;
        case 'm':
        case 'M':
          setViewMode('month');
          break;
        case 't':
        case 'T':
          goToToday();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, goToToday, showFilterMenu]);

  // Category filtering
  const toggleCategory = useCallback((category: TaskCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const selectAllCategories = useCallback(() => {
    setSelectedCategories(new Set(ALL_CATEGORIES));
  }, []);

  const clearAllCategories = useCallback(() => {
    setSelectedCategories(new Set());
  }, []);

  const toggleUser = useCallback((user: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(user)) {
        next.delete(user);
      } else {
        next.add(user);
      }
      return next;
    });
  }, []);

  const clearUserFilter = useCallback(() => {
    setSelectedUsers(new Set());
  }, []);

  // Step 1: Group and sort ALL active todos by date (only recomputes when `todos` changes)
  const allTodosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    todos.forEach((todo) => {
      if (!todo.due_date) return;
      if (todo.completed || todo.status === 'done') return;
      const dateKey = todo.due_date.split('T')[0];
      const existing = map.get(dateKey);
      if (existing) {
        existing.push(todo);
      } else {
        map.set(dateKey, [todo]);
      }
    });
    // Sort each day's tasks by priority: urgent > high > medium > low > undefined
    map.forEach((arr) => {
      arr.sort((a, b) => (PRIORITY_ORDER[a.priority || ''] ?? 4) - (PRIORITY_ORDER[b.priority || ''] ?? 4));
    });
    return map;
  }, [todos]);

  // Step 2: Filter the pre-grouped map by selected categories and users (cheap when only filters change)
  const todosByDate = useMemo(() => {
    const allCategoriesSelected = selectedCategories.size === ALL_CATEGORIES.length;
    const noUserFilter = selectedUsers.size === 0;

    // Fast path: no filters active
    if (allCategoriesSelected && noUserFilter) {
      return allTodosByDate;
    }

    const filtered = new Map<string, Todo[]>();
    allTodosByDate.forEach((dayTodos, dateKey) => {
      const matching = dayTodos.filter((todo) => {
        const categoryMatch = allCategoriesSelected || selectedCategories.has(todo.category || 'other');
        const userMatch = noUserFilter || (todo.assigned_to && selectedUsers.has(todo.assigned_to));
        return categoryMatch && userMatch;
      });
      if (matching.length > 0) {
        filtered.set(dateKey, matching);
      }
    });
    return filtered;
  }, [allTodosByDate, selectedCategories, selectedUsers]);

  // Category counts for current month
  // Uses string-based month extraction to avoid timezone issues with new Date()
  const categoryCounts = useMemo(() => {
    const counts: Record<TaskCategory, number> = {
      research: 0, meeting: 0, analysis: 0, submission: 0,
      revision: 0, presentation: 0, writing: 0, reading: 0,
      coursework: 0, admin: 0, grant: 0, teaching: 0,
      fieldwork: 0, other: 0,
    };
    const currentYearMonth = format(currentDate, 'yyyy-MM');
    todos.forEach((todo) => {
      if (!todo.due_date) return;
      // Extract YYYY-MM directly from the date string to avoid timezone shift
      const dueDateYearMonth = todo.due_date.substring(0, 7);
      if (dueDateYearMonth !== currentYearMonth) return;
      const category = todo.category || 'other';
      counts[category]++;
    });
    return counts;
  }, [todos, currentDate]);

  const uniqueAssignees = useMemo(() => {
    const users = new Set<string>();
    todos.forEach((todo) => {
      if (todo.assigned_to) users.add(todo.assigned_to);
    });
    return Array.from(users).sort();
  }, [todos]);

  // Detect whether current view includes today (for Today button pulse)
  const viewIncludesToday = useMemo(() => {
    const today = startOfDay(new Date());
    if (viewMode === 'day') return isSameDay(currentDate, today);
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return today >= weekStart && today <= weekEnd;
    }
    // month
    return currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  }, [currentDate, viewMode]);

  // Today's Focus stats
  const todayFocus = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const todayTodos = allTodosByDate.get(todayKey) || [];

    let overdueCount = 0;
    let reminderCount = 0;
    let waitingCount = 0;
    const totalToday = todayTodos.length;

    // Count across ALL todos (not just today's)
    todos.forEach((todo) => {
      if (todo.completed || todo.status === 'done') return;
      if (!todo.due_date) return;
      const dateKey = todo.due_date.split('T')[0];

      // Overdue = due before today and not done
      if (dateKey < todayKey) overdueCount++;

      // Waiting for response
      if (todo.waiting_for_response) waitingCount++;
    });

    // Reminders: count tasks with pending reminders from today's tasks
    todayTodos.forEach((todo) => {
      if (todo.reminders?.some((r) => r.status === 'pending') ||
          (todo.reminder_at && new Date(todo.reminder_at) > new Date())) {
        reminderCount++;
      }
    });

    return { totalToday, overdueCount, reminderCount, waitingCount };
  }, [todos, allTodosByDate]);

  // Navigation label
  const navLabel = viewMode === 'month' ? 'month' : viewMode === 'week' ? 'week' : 'day';

  // Accessible navigation announcement
  const headerLabel = getHeaderLabel(viewMode, currentDate);

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[var(--surface-2)] rounded-xl border border-[var(--border)] overflow-hidden print:border-0 print:shadow-none print:rounded-none">
      {/* Screen reader announcement for navigation changes */}
      <div aria-live="polite" className="sr-only">
        {headerLabel}
      </div>

      {/* Header */}
      <div role="navigation" aria-label="Calendar navigation" className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] print:border-0 print:py-2 print:bg-white">
        <div className="flex items-center gap-3">
          {/* Previous Button */}
          <button
            onClick={goToPrevious}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors print:hidden"
            aria-label={`Previous ${navLabel}`}
          >
            <ChevronLeft className="w-5 h-5 text-[var(--text-muted)]" />
          </button>

          {/* Date Display */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.h2
              key={getHeaderKey(viewMode, currentDate)}
              custom={direction}
              variants={headerVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="text-lg sm:text-xl font-semibold text-[var(--foreground)] min-w-[160px] text-center"
            >
              {getHeaderLabel(viewMode, currentDate)}
            </motion.h2>
          </AnimatePresence>

          {/* Next Button */}
          <button
            onClick={goToNext}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors print:hidden"
            aria-label={`Next ${navLabel}`}
          >
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
          </button>

          {/* Today Button */}
          <button
            onClick={goToToday}
            aria-label="Go to today"
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors print:hidden ${!viewIncludesToday ? 'animate-pulse ring-2 ring-[var(--accent)]/50' : ''}`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Today</span>
          </button>

          {/* Active Project Filter Badge */}
          {activeProjectName && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium print:hidden">
              <FolderOpen className="w-3.5 h-3.5" />
              {activeProjectName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--foreground)] print:hidden"
            aria-label="Print calendar"
            title="Print calendar"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* View Switcher */}
          <div className="print:hidden">
            <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>

          {/* Filter Button */}
          <div className="relative print:hidden">
            {(() => {
              const filtersActive = selectedCategories.size < ALL_CATEGORIES.length || selectedUsers.size > 0;
              const menuOpen = showFilterMenu;
              let btnClass = 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] border-transparent';
              if (menuOpen && filtersActive) {
                // Both: accent background + prominent border
                btnClass = 'bg-[var(--accent)]/15 text-[var(--accent)] border-2 border-[var(--accent)]';
              } else if (menuOpen) {
                // Menu open only: border highlight, no accent fill
                btnClass = 'bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--accent)]';
              } else if (filtersActive) {
                // Filters active, menu closed: subtle accent tint
                btnClass = 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30';
              }
              return (
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  aria-expanded={showFilterMenu}
                  aria-haspopup="true"
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border
                    ${btnClass}
                  `}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {filtersActive && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold">
                      {(selectedCategories.size < ALL_CATEGORIES.length ? 1 : 0) + (selectedUsers.size > 0 ? 1 : 0)}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Filter Dropdown */}
            <AnimatePresence>
              {showFilterMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowFilterMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] shadow-lg dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4)] z-50"
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5 mb-2 border-b border-[var(--border)]">
                      <button
                        onClick={selectAllCategories}
                        className="text-xs font-medium text-[var(--accent)] hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-[var(--text-muted)]">|</span>
                      <button
                        onClick={clearAllCategories}
                        className="text-xs font-medium text-[var(--text-muted)] hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-1">
                      {ALL_CATEGORIES.map((category) => {
                        const isSelected = selectedCategories.has(category);
                        const count = categoryCounts[category];
                        return (
                          <button
                            key={category}
                            onClick={() => toggleCategory(category)}
                            className={`
                              w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors
                              ${isSelected ? 'bg-[var(--surface)]' : 'hover:bg-[var(--surface-hover)]'}
                            `}
                          >
                            <div
                              className={`
                                w-4 h-4 rounded flex items-center justify-center transition-colors
                                ${isSelected ? 'bg-[var(--accent)]' : 'border-2 border-[var(--border)]'}
                              `}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </div>
                            <div className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[category]}`} />
                            <span className="flex-1 text-left text-sm text-[var(--foreground)]">
                              {CATEGORY_LABELS[category]}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Person Filter */}
                    {uniqueAssignees.length > 0 && (
                      <>
                        <div className="mt-2 pt-2 border-t border-[var(--border)]">
                          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Assigned To</span>
                            {selectedUsers.size > 0 && (
                              <button onClick={clearUserFilter} className="ml-auto text-xs text-[var(--accent)] hover:underline">
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {uniqueAssignees.map((user) => {
                              const isSelected = selectedUsers.has(user);
                              return (
                                <button
                                  key={user}
                                  onClick={() => toggleUser(user)}
                                  className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors ${isSelected ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--surface-hover)]'}`}
                                >
                                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--accent)]' : 'border-2 border-[var(--border)]'}`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                  </div>
                                  <span className="flex-1 text-left text-sm text-[var(--foreground)]">{user}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
        {/* Main View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewMode === 'month' && (
            <MonthView
              currentMonth={currentDate}
              direction={direction}
              todosByDate={todosByDate}
              onDateClick={handleDrillToDay}
              onAddTask={onDateClick}
              onTaskClick={onTaskClick}
              onReschedule={handleCalendarReschedule}
              onQuickComplete={onQuickComplete}
              onToggleWaiting={onToggleWaiting}
              onQuickAdd={onQuickAdd}
            />
          )}
          {viewMode === 'week' && (
            <WeekView
              currentDate={currentDate}
              direction={direction}
              todosByDate={todosByDate}
              onDateClick={handleDrillToDay}
              onAddTask={onDateClick}
              onTaskClick={onTaskClick}
              onReschedule={handleCalendarReschedule}
              onQuickComplete={onQuickComplete}
              onToggleWaiting={onToggleWaiting}
            />
          )}
          {viewMode === 'day' && (
            <DayView
              currentDate={currentDate}
              direction={direction}
              todosByDate={todosByDate}
              onDateClick={onDateClick}
              onTaskClick={onTaskClick}
              onQuickComplete={onQuickComplete}
              onToggleWaiting={onToggleWaiting}
              onQuickAdd={onQuickAdd}
            />
          )}
        </div>

        {/* Sidebar: Mini Calendar + Category Legend (visible on larger screens) */}
        <div className="hidden lg:flex flex-col w-56 border-l border-[var(--border)] bg-[var(--surface)] print:hidden">
          {/* Mini Calendar */}
          <div className="p-3 border-b border-[var(--border)]">
            <MiniCalendar
              currentDate={currentDate}
              todosByDate={todosByDate}
              onDateClick={handleMiniCalendarDateClick}
            />
          </div>

          {/* Today's Focus */}
          <div className="p-3 border-b border-[var(--border)]">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Today&apos;s Focus
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground)]">Today</span>
                <span className="font-semibold text-[var(--foreground)]">{todayFocus.totalToday}</span>
              </div>
              {todayFocus.overdueCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Overdue
                  </span>
                  <span className="font-semibold text-red-500">{todayFocus.overdueCount}</span>
                </div>
              )}
{todayFocus.waitingCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    Waiting
                  </span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{todayFocus.waitingCount}</span>
                </div>
              )}
              {todayFocus.reminderCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Bell className="w-3 h-3" />
                    Reminders
                  </span>
                  <span className="font-semibold text-[var(--text-muted)]">{todayFocus.reminderCount}</span>
                </div>
              )}
              {todayFocus.totalToday === 0 && todayFocus.overdueCount === 0 && (
                <p className="text-xs text-[var(--text-muted)] italic">All clear!</p>
              )}
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex-1 p-4 overflow-auto">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Category Filters
            </h3>
            <div className="space-y-1">
              {ALL_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.has(category);
                const count = categoryCounts[category];
                return (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`
                      w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors
                      ${isSelected ? 'bg-[var(--surface-2)] shadow-sm' : 'opacity-50 hover:opacity-75'}
                    `}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[category]}`} />
                    <span className="flex-1 text-sm text-[var(--foreground)]">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Person Filter */}
            {uniqueAssignees.length > 0 && (
              <div className="px-4 pb-4">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
                  Team Members
                </h3>
                <div className="space-y-1">
                  {uniqueAssignees.map((user) => {
                    const isSelected = selectedUsers.has(user);
                    return (
                      <button
                        key={user}
                        onClick={() => toggleUser(user)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${isSelected ? 'bg-[var(--accent)]/10 shadow-sm' : selectedUsers.size > 0 ? 'opacity-50 hover:opacity-75' : 'hover:bg-[var(--surface-hover)]'}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)]">
                          {user.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 text-sm text-[var(--foreground)] truncate">{user}</span>
                      </button>
                    );
                  })}
                  {selectedUsers.size > 0 && (
                    <button onClick={clearUserFilter} className="text-xs text-[var(--accent)] hover:underline px-2 py-1">
                      Show all
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] space-y-1">
                <p className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full ring-2 ring-[var(--accent)]" />
                  Today
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--border)]" />
                  Other months
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
