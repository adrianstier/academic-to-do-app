'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown, AlertTriangle, CheckSquare, ChevronDown,
  Filter, RotateCcw, Check, FileText, MoreHorizontal, Layers
} from 'lucide-react';
import { prefersReducedMotion, DURATION } from '@/lib/animations';
import { QuickFilter, SortOption, TodoStatus } from '@/types/todo';
import TemplatePicker from '../TemplatePicker';

interface DateRange {
  start: string;
  end: string;
}

interface TodoFiltersBarProps {
  // Quick filter state
  quickFilter: QuickFilter;
  setQuickFilter: (filter: QuickFilter) => void;

  // Toggle states
  highPriorityOnly: boolean;
  setHighPriorityOnly: (value: boolean) => void;
  showCompleted: boolean;
  setShowCompleted: (value: boolean) => void;

  // Advanced filters
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (value: boolean) => void;
  statusFilter: TodoStatus | 'all';
  setStatusFilter: (status: TodoStatus | 'all') => void;
  assignedToFilter: string;
  setAssignedToFilter: (assignee: string) => void;
  customerFilter: string;
  setCustomerFilter: (customer: string) => void;
  hasAttachmentsFilter: boolean | null;
  setHasAttachmentsFilter: (value: boolean | null) => void;
  dateRangeFilter: DateRange;
  setDateRangeFilter: (range: DateRange) => void;

  // Sort
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Dropdown states
  showMoreDropdown: boolean;
  setShowMoreDropdown: (show: boolean) => void;
  showTemplatePicker: boolean;
  setShowTemplatePicker: (show: boolean) => void;

  // Bulk actions
  showBulkActions: boolean;
  setShowBulkActions: (show: boolean) => void;
  clearSelection: () => void;

  // Sectioned view
  useSectionedView: boolean;
  setUseSectionedView: (value: boolean) => void;
  shouldUseSections: boolean;

  // Data for dropdowns
  users: string[];
  uniqueCustomers: string[];

  // Template callback
  onAddFromTemplate: (text: string, priority: 'low' | 'medium' | 'high' | 'urgent', assignedTo?: string, subtasks?: { id: string; text: string; completed: boolean }[]) => void;

  // Theme
  darkMode: boolean;
  userName: string;
}

function TodoFiltersBar({
  quickFilter,
  setQuickFilter,
  highPriorityOnly,
  setHighPriorityOnly,
  showCompleted,
  setShowCompleted,
  showAdvancedFilters,
  setShowAdvancedFilters,
  statusFilter,
  setStatusFilter,
  assignedToFilter,
  setAssignedToFilter,
  customerFilter,
  setCustomerFilter,
  hasAttachmentsFilter,
  setHasAttachmentsFilter,
  dateRangeFilter,
  setDateRangeFilter,
  sortOption,
  setSortOption,
  searchQuery,
  setSearchQuery,
  showMoreDropdown,
  setShowMoreDropdown,
  showTemplatePicker,
  setShowTemplatePicker,
  showBulkActions,
  setShowBulkActions,
  clearSelection,
  useSectionedView,
  setUseSectionedView,
  shouldUseSections,
  users,
  uniqueCustomers,
  onAddFromTemplate,
  darkMode,
  userName,
}: TodoFiltersBarProps) {
  const hasActiveFilters = quickFilter !== 'all' ||
    highPriorityOnly ||
    showCompleted ||
    searchQuery ||
    statusFilter !== 'all' ||
    assignedToFilter !== 'all' ||
    customerFilter !== 'all' ||
    hasAttachmentsFilter !== null ||
    dateRangeFilter.start ||
    dateRangeFilter.end;

  const advancedFilterCount = [
    statusFilter !== 'all',
    assignedToFilter !== 'all',
    customerFilter !== 'all',
    hasAttachmentsFilter !== null,
    dateRangeFilter.start || dateRangeFilter.end
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setQuickFilter('all');
    setHighPriorityOnly(false);
    setShowCompleted(false);
    setSearchQuery('');
    setStatusFilter('all');
    setAssignedToFilter('all');
    setCustomerFilter('all');
    setHasAttachmentsFilter(null);
    setDateRangeFilter({ start: '', end: '' });
  };

  return (
    <div className="mb-4">
      {/* Single Row: All filters, sort, select */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Quick filter dropdown - compact */}
        <div className="relative">
          <select
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}
            className="appearance-none pl-2 pr-6 py-1.5 text-xs font-medium rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
          >
            <option value="all">All</option>
            <option value="my_tasks">Mine</option>
            <option value="due_today">Today</option>
            <option value="overdue">Overdue</option>
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--text-muted)]" />
        </div>

        {/* High Priority toggle - icon only on mobile */}
        <button
          type="button"
          onClick={() => setHighPriorityOnly(!highPriorityOnly)}
          className={`flex items-center gap-1 px-3 min-h-[44px] text-xs font-medium rounded-md transition-all touch-manipulation ${
            highPriorityOnly
              ? 'bg-[var(--danger)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
          }`}
          aria-pressed={highPriorityOnly}
          title="High Priority"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Urgent</span>
        </button>

        {/* Show completed toggle - icon only on mobile */}
        <button
          type="button"
          onClick={() => setShowCompleted(!showCompleted)}
          className={`flex items-center gap-1 px-3 min-h-[44px] text-xs font-medium rounded-md transition-all touch-manipulation ${
            showCompleted
              ? 'bg-[var(--success)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
          }`}
          aria-pressed={showCompleted}
          title="Show Completed"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Done</span>
        </button>

        {/* More filters button */}
        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`flex items-center gap-1 px-3 min-h-[44px] text-xs font-medium rounded-md transition-all touch-manipulation ${
            showAdvancedFilters || advancedFilterCount > 0
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
          }`}
          aria-expanded={showAdvancedFilters}
          title="More Filters"
        >
          <Filter className="w-3.5 h-3.5" />
          {advancedFilterCount > 0 && (
            <span className="px-1 py-0.5 text-[10px] rounded-full bg-white/20 leading-none">
              {advancedFilterCount}
            </span>
          )}
        </button>

        {/* Sort dropdown - compact */}
        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            aria-label="Sort tasks"
            className="appearance-none pl-3 pr-8 min-h-[44px] text-xs font-medium rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] cursor-pointer hover:bg-[var(--surface-3)] transition-colors touch-manipulation"
          >
            <option value="created">New</option>
            <option value="due_date">Due</option>
            <option value="priority">Priority</option>
            <option value="urgency">Urgency</option>
            <option value="alphabetical">A-Z</option>
            <option value="custom">Manual</option>
          </select>
          <ArrowUpDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-[var(--text-muted)]" />
        </div>

        {/* More dropdown - contains Templates, Select, and Sections */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreDropdown(!showMoreDropdown)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
              showMoreDropdown || showBulkActions || useSectionedView
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] border border-[var(--border)]'
            }`}
            aria-expanded={showMoreDropdown}
            aria-haspopup="menu"
            title="More options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">More</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showMoreDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showMoreDropdown && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreDropdown(false)} />

              {/* Dropdown */}
              <div className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-50 overflow-hidden ${
                darkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-slate-200'
              }`}>
                {/* Templates button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreDropdown(false);
                    setShowTemplatePicker(true);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    darkMode ? 'hover:bg-[var(--surface-2)] text-[var(--foreground)]' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Templates</span>
                </button>

                {/* Select/Bulk actions button */}
                <button
                  type="button"
                  onClick={() => {
                    if (showBulkActions) {
                      clearSelection();
                    }
                    setShowBulkActions(!showBulkActions);
                    setShowMoreDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    showBulkActions
                      ? 'bg-[var(--brand-sky)]/10 text-[var(--brand-sky)]'
                      : darkMode ? 'hover:bg-[var(--surface-2)] text-[var(--foreground)]' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <CheckSquare className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>{showBulkActions ? 'Cancel Selection' : 'Select Tasks'}</span>
                </button>

                {/* Sections Toggle - Show when not using custom sort */}
                {shouldUseSections && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseSectionedView(!useSectionedView);
                      setShowMoreDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      useSectionedView
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : darkMode ? 'hover:bg-[var(--surface-2)] text-[var(--foreground)]' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                    aria-pressed={useSectionedView}
                  >
                    <Layers className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>Sections</span>
                    {useSectionedView && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Template Picker - controlled from More dropdown */}
        <div className="relative">
          <TemplatePicker
            currentUserName={userName}
            users={users}
            darkMode={darkMode}
            isOpen={showTemplatePicker}
            onOpenChange={setShowTemplatePicker}
            hideTrigger={true}
            onSelectTemplate={(text, priority, assignedTo, subtasks) => {
              onAddFromTemplate(text, priority, assignedTo, subtasks);
              setShowTemplatePicker(false);
            }}
          />
        </div>

        {/* Clear all - only when filters active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] font-medium"
            title="Clear all filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Selection mode hint */}
      {showBulkActions && (
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          Click tasks to select them
        </div>
      )}

      {/* Advanced Filters Panel - expandable */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={prefersReducedMotion() ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.normal }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* Status filter */}
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TodoStatus | 'all')}
                  className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                >
                  <option value="all">All</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {/* Assigned to filter */}
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Assigned</label>
                <select
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                >
                  <option value="all">Anyone</option>
                  <option value="unassigned">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>

              {/* Customer filter */}
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Customer</label>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                >
                  <option value="all">All</option>
                  {uniqueCustomers.map((customer) => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>
              </div>

              {/* Has attachments filter */}
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Attachments</label>
                <select
                  value={hasAttachmentsFilter === null ? 'all' : hasAttachmentsFilter ? 'yes' : 'no'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHasAttachmentsFilter(val === 'all' ? null : val === 'yes');
                  }}
                  className="w-full text-xs py-1.5 px-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)]"
                >
                  <option value="all">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              {/* Date range filter */}
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-light)] mb-1">Due Range</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={dateRangeFilter.start}
                    onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, start: e.target.value })}
                    className="flex-1 text-xs py-1.5 px-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] min-w-0"
                  />
                  <input
                    type="date"
                    value={dateRangeFilter.end}
                    onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, end: e.target.value })}
                    className="flex-1 text-xs py-1.5 px-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] min-w-0"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(TodoFiltersBar);
