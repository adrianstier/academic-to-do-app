'use client';

import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority, UpdateTaskInput, TaskStats } from '@/types/task';
import { getTasks, deleteTask, updateTask, getTaskStats, bulkUpdateTasks, clearAllTasks } from '@/lib/api';
import TaskList from '@/components/TaskList';
import TaskDetail from '@/components/TaskDetail';
import CreateTaskModal from '@/components/CreateTaskModal';
import Dashboard from '@/components/Dashboard';
import Toast from '@/components/Toast';

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
  }, [fetchTasks, fetchStats]);

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
    if (!confirm('Are you sure you want to delete ALL tasks? This cannot be undone!')) {
      return;
    }
    try {
      const result = await clearAllTasks();
      setTasks([]);
      setSelectedTask(null);
      setSelectedIds(new Set());
      showToast(result.message, 'success');
      fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear tasks', 'error');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Derrick&apos;s Agency Tasks</h1>
          <div className="flex gap-3">
            <button
              onClick={handleClearAllTasks}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium"
            >
              Clear All
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + New Task
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Dashboard */}
        <Dashboard stats={stats} onFilterClick={handleDashboardFilter} />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Assignees</option>
              <option value="Derrick">Derrick</option>
              <option value="Sefra">Sefra</option>
            </select>

            {/* Overdue Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOverdue}
                onChange={(e) => setShowOverdue(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <span className="text-sm text-red-600 font-medium">Overdue Only</span>
            </label>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => { fetchTasks(); fetchStats(); }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-blue-700 font-medium">
              {selectedIds.size} task{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('done')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Mark Done
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Task List */}
          <div className={`${selectedTask ? 'w-1/2' : 'w-full'} transition-all`}>
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                {hasActiveFilters ? 'No tasks match your filters.' : 'No tasks found. Create one to get started!'}
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
    </div>
  );
}
