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
  todo: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-[#e6f0f9] text-[#003B73] border-[#0071CE]/30',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const priorityColors: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const priorityDots: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-4 py-4 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 text-[#003B73] rounded focus:ring-[#0071CE] cursor-pointer"
              />
            </th>
            <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-24">
              Priority
            </th>
            <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Assignee
            </th>
            <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              Due Date
            </th>
            <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12">
              Info
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task, index) => {
            const overdue = isOverdue(task.dueDate, task.status);
            const isSelected = selectedId === task.id;
            const isChecked = selectedIds.has(task.id);
            return (
              <tr
                key={task.id}
                onClick={() => onSelect(task)}
                className={`cursor-pointer transition-all duration-200 group ${
                  isSelected
                    ? 'bg-[#e6f0f9] border-l-4 border-l-[#003B73]'
                    : isChecked
                    ? 'bg-[#e6f0f9]/50'
                    : overdue
                    ? 'bg-red-50/50 hover:bg-red-50'
                    : 'hover:bg-gray-50'
                }`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className={`px-4 py-4 ${isSelected ? 'pl-3' : ''}`} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onSelectTask(task.id, e.target.checked)}
                    className="w-4 h-4 text-[#003B73] rounded focus:ring-[#0071CE] cursor-pointer"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm ${priorityDots[task.priority as TaskPriority] || priorityDots.medium}`}></span>
                    <div className="min-w-0">
                      <div className={`font-medium truncate max-w-xs ${overdue ? 'text-red-700' : 'text-gray-900'} group-hover:text-[#003B73] transition-colors`}>
                        {task.title}
                      </div>
                      {task.category && (
                        <span className="inline-flex items-center mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                          {task.category}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <select
                    value={task.priority}
                    onChange={(e) => {
                      e.stopPropagation();
                      onPriorityChange(task.id, e.target.value as TaskPriority);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${
                      priorityColors[task.priority as TaskPriority] || priorityColors.medium
                    }`}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </td>
                <td className="px-4 py-4">
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0071CE] to-[#003B73] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {task.assignee.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700 font-medium">{task.assignee}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <select
                    value={task.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      onStatusChange(task.id, e.target.value as TaskStatus);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                      statusColors[task.status as TaskStatus]
                    }`}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </td>
                <td className="px-4 py-4">
                  <div className={`text-sm font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                    {formatDate(task.dueDate)}
                    {overdue && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 font-semibold">
                        Overdue
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {task.sourceEmailId && (
                      <span title={`From: ${task.sourceEmailFrom}`} className="text-[#0071CE] hover:text-[#003B73] transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      </span>
                    )}
                    {task.notes && task.notes.length > 0 && (
                      <span title={`${task.notes.length} note(s)`} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-medium">{task.notes.length}</span>
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
