'use client';

import { TaskStats } from '@/types/task';

interface DashboardProps {
  stats: TaskStats | null;
  onFilterClick: (filter: { status?: string; priority?: string; overdue?: boolean }) => void;
}

export default function Dashboard({ stats, onFilterClick }: DashboardProps) {
  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Total */}
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Tasks</div>
        </div>

        {/* Overdue */}
        <button
          onClick={() => onFilterClick({ overdue: true })}
          className={`rounded-lg p-4 text-center transition-colors ${
            stats.overdue > 0
              ? 'bg-red-50 hover:bg-red-100'
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <div className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {stats.overdue}
          </div>
          <div className={`text-sm ${stats.overdue > 0 ? 'text-red-500' : 'text-gray-500'}`}>
            Overdue
          </div>
        </button>

        {/* Due Today */}
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.dueToday}</div>
          <div className="text-sm text-orange-500">Due Today</div>
        </div>

        {/* Due Soon (7 days) */}
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.dueSoon}</div>
          <div className="text-sm text-yellow-500">Due Soon</div>
        </div>

        {/* To Do */}
        <button
          onClick={() => onFilterClick({ status: 'todo' })}
          className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 text-center transition-colors"
        >
          <div className="text-2xl font-bold text-gray-700">{stats.byStatus.todo || 0}</div>
          <div className="text-sm text-gray-500">To Do</div>
        </button>

        {/* In Progress */}
        <button
          onClick={() => onFilterClick({ status: 'in_progress' })}
          className="bg-blue-50 hover:bg-blue-100 rounded-lg p-4 text-center transition-colors"
        >
          <div className="text-2xl font-bold text-blue-600">{stats.byStatus.in_progress || 0}</div>
          <div className="text-sm text-blue-500">In Progress</div>
        </button>

        {/* Done */}
        <button
          onClick={() => onFilterClick({ status: 'done' })}
          className="bg-green-50 hover:bg-green-100 rounded-lg p-4 text-center transition-colors"
        >
          <div className="text-2xl font-bold text-green-600">{stats.byStatus.done || 0}</div>
          <div className="text-sm text-green-500">Done</div>
        </button>
      </div>

      {/* Priority & Assignee breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* By Priority */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">By Priority</h3>
          <div className="flex gap-4">
            <button
              onClick={() => onFilterClick({ priority: 'high' })}
              className="flex items-center gap-2 hover:opacity-80"
            >
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-sm text-gray-600">High: {stats.byPriority.high || 0}</span>
            </button>
            <button
              onClick={() => onFilterClick({ priority: 'medium' })}
              className="flex items-center gap-2 hover:opacity-80"
            >
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-sm text-gray-600">Medium: {stats.byPriority.medium || 0}</span>
            </button>
            <button
              onClick={() => onFilterClick({ priority: 'low' })}
              className="flex items-center gap-2 hover:opacity-80"
            >
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-sm text-gray-600">Low: {stats.byPriority.low || 0}</span>
            </button>
          </div>
        </div>

        {/* By Assignee */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">By Assignee</h3>
          <div className="flex gap-4">
            {Object.entries(stats.byAssignee).map(([name, count]) => (
              <span key={name} className="text-sm text-gray-600">
                {name}: {count}
              </span>
            ))}
            {Object.keys(stats.byAssignee).length === 0 && (
              <span className="text-sm text-gray-400">No assigned tasks</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
