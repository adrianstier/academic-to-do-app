'use client';

import { Task, TaskStatus, TaskPriority } from '@/types/task';

interface TaskListProps {
  tasks: Task[];
  selectedId?: string;
  selectedIds: Set<string>;
  onSelect: (task: Task) => void;
  onSelectTask: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
}

const statusColors: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

const priorityColors: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const priorityDots: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dateString: string | null, status: string): boolean {
  if (!dateString || status === 'done') return false;
  return new Date(dateString) < new Date();
}

export default function TaskList({
  tasks,
  selectedId,
  selectedIds,
  onSelect,
  onSelectTask,
  onSelectAll,
  onStatusChange,
  onPriorityChange,
}: TaskListProps) {
  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));
  const someSelected = tasks.some((t) => selectedIds.has(t.id));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Title
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
              Priority
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Assignee
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Due Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
              Info
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueDate, task.status);
            return (
              <tr
                key={task.id}
                onClick={() => onSelect(task)}
                className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedId === task.id ? 'bg-blue-50' : ''
                } ${overdue ? 'bg-red-50 hover:bg-red-100' : ''}`}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={(e) => onSelectTask(task.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDots[task.priority as TaskPriority] || priorityDots.medium}`}></span>
                    <div>
                      <div className={`font-medium truncate max-w-xs ${overdue ? 'text-red-700' : 'text-gray-900'}`}>
                        {task.title}
                      </div>
                      {task.category && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {task.category}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={task.priority}
                    onChange={(e) => {
                      e.stopPropagation();
                      onPriorityChange(task.id, e.target.value as TaskPriority);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${
                      priorityColors[task.priority as TaskPriority] || priorityColors.medium
                    }`}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {task.assignee || '-'}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={task.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      onStatusChange(task.id, e.target.value as TaskStatus);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer ${
                      statusColors[task.status as TaskStatus]
                    }`}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </td>
                <td className={`px-4 py-3 text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                  {formatDate(task.dueDate)}
                  {overdue && (
                    <span className="ml-1 text-xs text-red-500">(overdue)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {task.sourceEmailId && (
                      <span title={`From: ${task.sourceEmailFrom}`} className="text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      </span>
                    )}
                    {task.notes && task.notes.length > 0 && (
                      <span title={`${task.notes.length} note(s)`} className="text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
