'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  Calendar,
  User,
  Paperclip,
  CheckSquare,
  Filter,
  ArrowUpDown,
  RotateCcw,
  Trash2,
  Download,
  FileText,
  Mic,
  Check,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Todo, PRIORITY_CONFIG } from '@/types/todo';
import { useFilters } from '@/hooks/useFilters';
import ArchivedTaskModal from './ArchivedTaskModal';

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE VIEW
// Full-featured archive browser with filtering, sorting, and bulk actions
// ═══════════════════════════════════════════════════════════════════════════

interface ArchiveViewProps {
  currentUser: { name: string; role: string };
  users: string[];
  onRestore: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onClose: () => void;
}

// Archive filter types
type ArchiveSortOption = 'completion_date_desc' | 'completion_date_asc' | 'name_asc' | 'name_desc' | 'priority_high' | 'priority_low';
type ArchiveDatePreset = 'all' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_year';

interface ArchiveFilters {
  query: string;
  datePreset: ArchiveDatePreset;
  customDateStart: string;
  customDateEnd: string;
  assignee: string;
  hasAttachments: boolean | null;
  hasSubtasks: boolean | null;
  priority: string;
  sortBy: ArchiveSortOption;
}

const DATE_PRESETS: { value: ArchiveDatePreset; label: string; days?: number }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'last_7_days', label: 'Last 7 Days', days: 7 },
  { value: 'last_30_days', label: 'Last 30 Days', days: 30 },
  { value: 'last_90_days', label: 'Last 90 Days', days: 90 },
  { value: 'this_year', label: 'This Year' },
];

const SORT_OPTIONS: { value: ArchiveSortOption; label: string }[] = [
  { value: 'completion_date_desc', label: 'Newest First' },
  { value: 'completion_date_asc', label: 'Oldest First' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'priority_high', label: 'Priority High→Low' },
  { value: 'priority_low', label: 'Priority Low→High' },
];

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function ArchiveView({
  currentUser,
  users,
  onRestore,
  onDelete,
  onClose,
}: ArchiveViewProps) {
  const { archivedTodos } = useFilters(currentUser.name);

  // Filter state
  const [filters, setFilters] = useState<ArchiveFilters>({
    query: '',
    datePreset: 'all',
    customDateStart: '',
    customDateEnd: '',
    assignee: 'all',
    hasAttachments: null,
    hasSubtasks: null,
    priority: 'all',
    sortBy: 'completion_date_desc',
  });

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);

  // Get completion timestamp for a todo
  const getCompletionTime = useCallback((todo: Todo): number => {
    const raw = todo.updated_at || todo.created_at;
    return raw ? new Date(raw).getTime() : 0;
  }, []);

  // Filter and sort archived todos
  const filteredTodos = useMemo(() => {
    let result = [...archivedTodos];

    // Text search
    if (filters.query) {
      const query = filters.query.toLowerCase();
      result = result.filter((todo) =>
        todo.text.toLowerCase().includes(query) ||
        todo.created_by.toLowerCase().includes(query) ||
        (todo.assigned_to && todo.assigned_to.toLowerCase().includes(query)) ||
        (todo.notes && todo.notes.toLowerCase().includes(query)) ||
        (todo.transcription && todo.transcription.toLowerCase().includes(query))
      );
    }

    // Date filter
    if (filters.datePreset !== 'all') {
      const now = Date.now();
      let cutoffMs: number;

      if (filters.datePreset === 'this_year') {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
        cutoffMs = startOfYear;
      } else {
        const preset = DATE_PRESETS.find(p => p.value === filters.datePreset);
        cutoffMs = now - (preset?.days || 0) * 24 * 60 * 60 * 1000;
      }

      result = result.filter((todo) => {
        const completedAt = getCompletionTime(todo);
        return completedAt >= cutoffMs;
      });
    }

    // Custom date range
    if (filters.customDateStart) {
      const startMs = new Date(filters.customDateStart).getTime();
      result = result.filter((todo) => getCompletionTime(todo) >= startMs);
    }
    if (filters.customDateEnd) {
      const endMs = new Date(filters.customDateEnd).getTime() + 24 * 60 * 60 * 1000; // Include end date
      result = result.filter((todo) => getCompletionTime(todo) <= endMs);
    }

    // Assignee filter
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned') {
        result = result.filter((todo) => !todo.assigned_to);
      } else {
        result = result.filter((todo) => todo.assigned_to === filters.assignee);
      }
    }

    // Attachments filter
    if (filters.hasAttachments !== null) {
      result = result.filter((todo) => {
        const hasAtt = todo.attachments && todo.attachments.length > 0;
        return filters.hasAttachments ? hasAtt : !hasAtt;
      });
    }

    // Subtasks filter
    if (filters.hasSubtasks !== null) {
      result = result.filter((todo) => {
        const hasSub = todo.subtasks && todo.subtasks.length > 0;
        return filters.hasSubtasks ? hasSub : !hasSub;
      });
    }

    // Priority filter
    if (filters.priority !== 'all') {
      result = result.filter((todo) => (todo.priority || 'medium') === filters.priority);
    }

    // Sorting
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'completion_date_desc':
          return getCompletionTime(b) - getCompletionTime(a);
        case 'completion_date_asc':
          return getCompletionTime(a) - getCompletionTime(b);
        case 'name_asc':
          return a.text.localeCompare(b.text);
        case 'name_desc':
          return b.text.localeCompare(a.text);
        case 'priority_high':
          return priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
        case 'priority_low':
          return priorityOrder[b.priority || 'medium'] - priorityOrder[a.priority || 'medium'];
        default:
          return 0;
      }
    });

    return result;
  }, [archivedTodos, filters, getCompletionTime]);

  // Statistics
  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const thisWeek = archivedTodos.filter((t) => getCompletionTime(t) >= weekAgo).length;
    const thisMonth = archivedTodos.filter((t) => getCompletionTime(t) >= monthAgo).length;

    // Top completers
    const completers: Record<string, number> = {};
    archivedTodos.forEach((t) => {
      const completer = t.assigned_to || t.created_by;
      completers[completer] = (completers[completer] || 0) + 1;
    });
    const topCompleters = Object.entries(completers)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    // Priority breakdown
    const byPriority: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    archivedTodos.forEach((t) => {
      const p = t.priority || 'medium';
      byPriority[p] = (byPriority[p] || 0) + 1;
    });

    return {
      total: archivedTodos.length,
      thisWeek,
      thisMonth,
      topCompleters,
      byPriority,
    };
  }, [archivedTodos, getCompletionTime]);

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredTodos.map((t) => t.id)));
  }, [filteredTodos]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Action handlers
  const handleRestore = useCallback(async (id: string) => {
    setIsRestoring(id);
    try {
      await onRestore(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setIsRestoring(null);
    }
  }, [onRestore]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Permanently delete this task? This cannot be undone.')) return;
    setIsDeleting(id);
    try {
      await onDelete(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setIsDeleting(null);
    }
  }, [onDelete]);

  const handleBulkRestore = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Restore ${selectedIds.size} task(s) to active list?`)) return;

    for (const id of selectedIds) {
      await handleRestore(id);
    }
  }, [selectedIds, handleRestore]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} task(s)? This cannot be undone.`)) return;

    for (const id of selectedIds) {
      setIsDeleting(id);
      try {
        await onDelete(id);
      } finally {
        setIsDeleting(null);
      }
    }
    setSelectedIds(new Set());
  }, [selectedIds, onDelete]);

  // Export to CSV
  const handleExport = useCallback(() => {
    const headers = ['Task', 'Assignee', 'Created By', 'Priority', 'Completed Date', 'Notes'];
    const rows = filteredTodos.map((t) => [
      `"${t.text.replace(/"/g, '""')}"`,
      t.assigned_to || '',
      t.created_by,
      t.priority || 'medium',
      new Date(getCompletionTime(t)).toLocaleDateString(),
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTodos, getCompletionTime]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters({
      query: '',
      datePreset: 'all',
      customDateStart: '',
      customDateEnd: '',
      assignee: 'all',
      hasAttachments: null,
      hasSubtasks: null,
      priority: 'all',
      sortBy: 'completion_date_desc',
    });
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.query !== '' ||
      filters.datePreset !== 'all' ||
      filters.customDateStart !== '' ||
      filters.customDateEnd !== '' ||
      filters.assignee !== 'all' ||
      filters.hasAttachments !== null ||
      filters.hasSubtasks !== null ||
      filters.priority !== 'all'
    );
  }, [filters]);

  // Format relative time
  const formatRelativeTime = useCallback((ms: number) => {
    const now = Date.now();
    const diff = now - ms;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">Archive</h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {archivedTodos.length} completed tasks
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Close archive"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {showStats && (
          <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-2)]">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">This week:</span>
                <span className="font-medium text-[var(--foreground)]">{stats.thisWeek}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-[var(--text-muted)]">This month:</span>
                <span className="font-medium text-[var(--foreground)]">{stats.thisMonth}</span>
              </div>
              {stats.topCompleters.length > 0 && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Top:</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {stats.topCompleters[0][0]} ({stats.topCompleters[0][1]})
                  </span>
                </div>
              )}
              <button
                onClick={() => setShowStats(false)}
                className="ml-auto text-[var(--text-muted)] hover:text-[var(--foreground)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="px-6 py-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-light)]" />
              <input
                type="text"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                placeholder="Search archived tasks..."
                className="input-refined w-full !pl-10 pr-4 py-2 text-sm"
              />
              {filters.query && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, query: '' }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--foreground)]'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-xs">
                  !
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as ArchiveSortOption }))}
                className="appearance-none px-3 py-2 pr-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] cursor-pointer hover:bg-[var(--surface-2)]"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-2)] text-sm font-medium text-[var(--foreground)] transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Date Preset */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    Date Range
                  </label>
                  <select
                    value={filters.datePreset}
                    onChange={(e) => setFilters((f) => ({
                      ...f,
                      datePreset: e.target.value as ArchiveDatePreset,
                      customDateStart: '',
                      customDateEnd: '',
                    }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    {DATE_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Assignee */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    Completed By
                  </label>
                  <select
                    value={filters.assignee}
                    onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    <option value="all">All Users</option>
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    Priority
                  </label>
                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    Attachments
                  </label>
                  <select
                    value={filters.hasAttachments === null ? 'all' : filters.hasAttachments ? 'yes' : 'no'}
                    onChange={(e) => setFilters((f) => ({
                      ...f,
                      hasAttachments: e.target.value === 'all' ? null : e.target.value === 'yes'
                    }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    <option value="all">Any</option>
                    <option value="yes">Has Attachments</option>
                    <option value="no">No Attachments</option>
                  </select>
                </div>
              </div>

              {/* Custom Date Range */}
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                <span className="text-xs font-medium text-[var(--text-muted)]">Custom Range:</span>
                <input
                  type="date"
                  value={filters.customDateStart}
                  onChange={(e) => setFilters((f) => ({ ...f, customDateStart: e.target.value, datePreset: 'all' }))}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                />
                <span className="text-[var(--text-muted)]">to</span>
                <input
                  type="date"
                  value={filters.customDateEnd}
                  onChange={(e) => setFilters((f) => ({ ...f, customDateEnd: e.target.value, datePreset: 'all' }))}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
                />

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--accent)]/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--foreground)]"
                >
                  Clear
                </button>
                <button
                  onClick={selectAll}
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  Select all {filteredTodos.length}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkRestore}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent)]/90 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTodos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {hasActiveFilters ? 'No tasks match your filters' : 'No archived tasks'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] max-w-sm">
              {hasActiveFilters
                ? 'Try adjusting your filters or search query to find what you\'re looking for.'
                : 'Completed tasks will appear here after 48 hours.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent)]/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Results count */}
            <div className="text-sm text-[var(--text-muted)] mb-4">
              Showing {filteredTodos.length} of {archivedTodos.length} archived tasks
            </div>

            {filteredTodos.map((todo) => {
              const completedAt = getCompletionTime(todo);
              const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;
              const hasAttachments = todo.attachments && todo.attachments.length > 0;
              const hasNotes = todo.notes || todo.transcription;
              const priorityConfig = PRIORITY_CONFIG[todo.priority || 'medium'];
              const isSelected = selectedIds.has(todo.id);
              const isProcessing = isRestoring === todo.id || isDeleting === todo.id;

              return (
                <div
                  key={todo.id}
                  className={`group relative rounded-[var(--radius-lg)] border transition-all ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'
                  } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-start gap-4 p-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelection(todo.id)}
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--accent)]'
                          : 'border-[var(--border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Content */}
                    <button
                      onClick={() => setSelectedTodo(todo)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                              {todo.text}
                            </h3>
                            <span
                              className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `${priorityConfig.color}20`,
                                color: priorityConfig.color,
                              }}
                            >
                              {todo.priority || 'medium'}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {todo.assigned_to ? `${todo.assigned_to}` : 'Unassigned'} • {todo.created_by}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatRelativeTime(completedAt)}
                          </p>
                          <p className="text-xs text-[var(--text-light)]">
                            {new Date(completedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Metadata badges */}
                      <div className="flex items-center gap-3 mt-2">
                        {hasSubtasks && (
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <CheckSquare className="w-3 h-3" />
                            {todo.subtasks!.filter((st) => st.completed).length}/{todo.subtasks!.length}
                          </span>
                        )}
                        {hasAttachments && (
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Paperclip className="w-3 h-3" />
                            {todo.attachments!.length}
                          </span>
                        )}
                        {todo.notes && (
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <FileText className="w-3 h-3" />
                            Notes
                          </span>
                        )}
                        {todo.transcription && (
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Mic className="w-3 h-3" />
                            Voicemail
                          </span>
                        )}
                      </div>

                      {/* Preview of notes/transcription */}
                      {hasNotes && (
                        <p className="text-xs text-[var(--text-light)] mt-2 line-clamp-1">
                          {todo.notes || todo.transcription}
                        </p>
                      )}
                    </button>

                    {/* Quick Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRestore(todo.id)}
                        disabled={isProcessing}
                        className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                        title="Restore task"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(todo.id)}
                        disabled={isProcessing}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Processing overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/80 rounded-[var(--radius-lg)]">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {isRestoring === todo.id ? 'Restoring...' : 'Deleting...'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTodo && (
        <ArchivedTaskModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
        />
      )}
    </div>
  );
}
