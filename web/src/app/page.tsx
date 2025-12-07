'use client';

import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority, UpdateTaskInput, TaskStats } from '@/types/task';
import { getTasks, deleteTask, updateTask, getTaskStats, bulkUpdateTasks, clearAllTasks } from '@/lib/api';
import TaskList from '@/components/TaskList';
import TaskDetail from '@/components/TaskDetail';
import CreateTaskModal from '@/components/CreateTaskModal';
import Dashboard from '@/components/Dashboard';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import OnboardingModal from '@/components/OnboardingModal';

type ToastType = 'success' | 'error';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOverdue, setShowOverdue] = useState(false);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStats = useCallback(async () => {
    try {
      const data = await getTaskStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTasks({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        assignee: assigneeFilter || undefined,
        search: searchQuery || undefined,
        overdue: showOverdue || undefined,
      });
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, assigneeFilter, searchQuery, showOverdue]);

  useEffect(() => {
    fetchTasks();
    fetchStats();

    // Check if user is first-time visitor
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, [fetchTasks, fetchStats]);

  const handleCloseOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setShowCreateModal(false);
    showToast('Task created successfully', 'success');
    fetchStats();
  };

  const handleTaskUpdated = async (id: string, updates: UpdateTaskInput) => {
    try {
      const updated = await updateTask(id, updates);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setSelectedTask(updated);
      showToast('Task updated successfully', 'success');
      fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update task', 'error');
    }
  };

  const handleTaskDeleted = async (id: string) => {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSelectedTask(null);
      showToast('Task deleted successfully', 'success');
      fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete task', 'error');
    }
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    await handleTaskUpdated(id, { status });
  };

  const handlePriorityChange = async (id: string, priority: TaskPriority) => {
    await handleTaskUpdated(id, { priority });
  };

  const handleDashboardFilter = (filter: { status?: string; priority?: string; overdue?: boolean }) => {
    setStatusFilter(filter.status || '');
    setPriorityFilter(filter.priority || '');
    setShowOverdue(filter.overdue || false);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setSearchQuery('');
    setShowOverdue(false);
  };

  const handleSelectTask = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkAction = async (action: 'done' | 'delete') => {
    if (selectedIds.size === 0) return;

    try {
      if (action === 'delete') {
        await bulkUpdateTasks(Array.from(selectedIds), 'delete');
        setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
        showToast(`Deleted ${selectedIds.size} tasks`, 'success');
      } else if (action === 'done') {
        await bulkUpdateTasks(Array.from(selectedIds), 'update', { status: 'done' });
        setTasks((prev) =>
          prev.map((t) => (selectedIds.has(t.id) ? { ...t, status: 'done' as TaskStatus } : t))
        );
        showToast(`Marked ${selectedIds.size} tasks as done`, 'success');
      }
      setSelectedIds(new Set());
      fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk action failed', 'error');
    }
  };

  const hasActiveFilters = statusFilter || priorityFilter || assigneeFilter || searchQuery || showOverdue;

  const handleClearAllTasks = async () => {
    try {
      const result = await clearAllTasks();
      setTasks([]);
      setSelectedTask(null);
      setSelectedIds(new Set());
      showToast(result.message, 'success');
      fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear tasks', 'error');
    } finally {
      setShowClearAllModal(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkUpdateTasks(Array.from(selectedIds), 'delete');
      setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      showToast(`Deleted ${selectedIds.size} tasks`, 'success');
      setSelectedIds(new Set());
      fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete tasks', 'error');
    } finally {
      setShowBulkDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#003B73] via-[#004d8f] to-[#003B73] shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Derrick&apos;s Agency Tasks</h1>
                <p className="text-blue-200 text-sm">Manage and track your team&apos;s work</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClearAllModal(true)}
                className="px-4 py-2.5 text-white/90 border border-white/30 rounded-xl hover:bg-white/10 hover:border-white/50 transition-all font-medium backdrop-blur-sm"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-[#003B73] px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Task
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Dashboard */}
        <Dashboard stats={stats} onFilterClick={handleDashboardFilter} />

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0071CE] focus:border-transparent focus:bg-white transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0071CE] focus:border-transparent cursor-pointer hover:bg-gray-100 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0071CE] focus:border-transparent cursor-pointer hover:bg-gray-100 transition-all"
            >
              <option value="">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0071CE] focus:border-transparent cursor-pointer hover:bg-gray-100 transition-all"
            >
              <option value="">All Assignees</option>
              <option value="Derrick">Derrick</option>
              <option value="Sefra">Sefra</option>
            </select>

            {/* Overdue Toggle */}
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all ${showOverdue ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              <input
                type="checkbox"
                checked={showOverdue}
                onChange={(e) => setShowOverdue(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium">Overdue</span>
            </label>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-medium flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => { fetchTasks(); fetchStats(); }}
              className="p-2.5 text-gray-500 hover:text-[#0071CE] bg-gray-50 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-[#0071CE]/30 transition-all"
              title="Refresh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-gradient-to-r from-[#e6f0f9] to-blue-50 border border-[#0071CE]/30 rounded-2xl p-4 mb-6 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#0071CE]/20 rounded-xl flex items-center justify-center">
                <span className="text-[#003B73] font-bold">{selectedIds.size}</span>
              </div>
              <span className="text-[#003B73] font-medium">
                task{selectedIds.size > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('done')}
                className="px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-medium flex items-center gap-2 shadow-sm hover:shadow"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mark Done
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-medium flex items-center gap-2 shadow-sm hover:shadow"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-2xl mb-6 flex items-center gap-3 animate-fadeIn">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Task List */}
          <div className={`${selectedTask ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#e6f0f9] rounded-2xl mb-4">
                  <svg className="animate-spin h-8 w-8 text-[#0071CE]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">Loading tasks...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 rounded-2xl mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {hasActiveFilters ? 'No matching tasks' : 'No tasks yet'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {hasActiveFilters ? 'Try adjusting your filters to see more tasks.' : 'Get started by creating your first task.'}
                </p>
                {!hasActiveFilters && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 bg-[#003B73] text-white px-5 py-2.5 rounded-xl hover:bg-[#002d59] transition-all font-medium shadow-sm hover:shadow"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Task
                  </button>
                )}
              </div>
            ) : (
              <TaskList
                tasks={tasks}
                selectedId={selectedTask?.id}
                selectedIds={selectedIds}
                onSelect={setSelectedTask}
                onSelectTask={handleSelectTask}
                onSelectAll={handleSelectAll}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
              />
            )}
          </div>

          {/* Task Detail */}
          {selectedTask && (
            <div className="w-1/2">
              <TaskDetail
                task={selectedTask}
                onUpdate={handleTaskUpdated}
                onDelete={handleTaskDeleted}
                onClose={() => setSelectedTask(null)}
                onNoteAdded={(updatedTask) => {
                  setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
                  setSelectedTask(updatedTask);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTaskCreated}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Clear All Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearAllModal}
        title="Delete All Tasks"
        message="Are you sure you want to delete ALL tasks? This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        onConfirm={handleClearAllTasks}
        onCancel={() => setShowClearAllModal(false)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteModal}
        title="Delete Selected Tasks"
        message={`Are you sure you want to delete ${selectedIds.size} selected task${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteModal(false)}
      />

      {/* Onboarding Modal for First-Time Users */}
      {showOnboarding && (
        <OnboardingModal
          onClose={handleCloseOnboarding}
          onCreateTask={() => {
            handleCloseOnboarding();
            setShowCreateModal(true);
          }}
        />
      )}
    </div>
  );
}
